"""
Omega RAG — Lange-termijn geheugen met sqlite-vec.
Indexeert logs, SOUL.md-bestanden en optioneel notes; query_memory(question) voor retrieval.
"""
import logging
import sqlite3
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent
logger = logging.getLogger(__name__)

# all-MiniLM-L6-v2 dimension
VEC_DIM = 384
CHUNK_SIZE = 800
CHUNK_OVERLAP = 150

_embedder = None


def _get_embedder():
    """Lazy load sentence-transformers of fallback (zeros)."""
    global _embedder
    if _embedder is not None:
        return _embedder
    try:
        from sentence_transformers import SentenceTransformer
        _embedder = SentenceTransformer("all-MiniLM-L6-v2")
        return _embedder
    except Exception as e:
        logger.warning("sentence_transformers niet beschikbaar, RAG gebruikt placeholder: %s", e)
        _embedder = "placeholder"
        return _embedder


def _embed(text: str) -> list[float]:
    """Embed tekst naar vector (384 dim)."""
    emb = _get_embedder()
    if emb == "placeholder":
        # Deterministic pseudo-embedding zodat query altijd dezelfde vector krijgt
        import hashlib
        h = hashlib.sha256(text.encode("utf-8")).digest()
        return [((b - 128) / 128.0) for b in h[:VEC_DIM]] + [0.0] * (VEC_DIM - len(h))
    import numpy as np
    vec = emb.encode(text, convert_to_numpy=True)
    return vec.astype(float).tolist()


def _chunk_text(text: str, size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Split tekst in chunks met overlap."""
    text = text.strip()
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = start + size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start = end - overlap
        if start >= len(text):
            break
    return chunks


def _vec_available() -> bool:
    try:
        import sqlite_vec  # noqa: F401
        return True
    except ImportError:
        return False


def _get_connection_with_vec():
    """Database-connectie met sqlite-vec geladen indien beschikbaar."""
    import omega_db
    omega_db.init_schema()
    path = str(omega_db.DATABASE_PATH)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    if getattr(conn, "enable_load_extension", None):
        conn.enable_load_extension(True)
        try:
            import sqlite_vec
            sqlite_vec.load(conn)
        except Exception as e:
            logger.debug("sqlite_vec.load: %s", e)
        conn.enable_load_extension(False)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    return conn


def init_rag_schema() -> None:
    """Maak rag_chunks en vec0-rag_vectors aan."""
    conn = _get_connection_with_vec()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS rag_chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_type TEXT NOT NULL,
                source_id TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_rag_source ON rag_chunks(source_type, source_id);")
        if _vec_available():
            try:
                conn.execute(
                    "CREATE VIRTUAL TABLE IF NOT EXISTS rag_vectors USING vec0(embedding float[%d])" % VEC_DIM
                )
            except sqlite3.OperationalError as e:
                if "no such module" not in str(e).lower():
                    logger.warning("rag_vectors: %s", e)
        conn.commit()
    finally:
        conn.close()


def _insert_chunk(conn, source_type: str, source_id: str, content: str, embedding: list[float], created_at: str) -> None:
    cur = conn.execute(
        "INSERT INTO rag_chunks (source_type, source_id, content, created_at) VALUES (?, ?, ?, ?)",
        (source_type, source_id, content[:10000], created_at),
    )
    rowid = cur.lastrowid
    if _vec_available():
        try:
            from sqlite_vec import serialize_float32
            blob = serialize_float32(embedding)
            conn.execute("INSERT INTO rag_vectors(rowid, embedding) VALUES (?, ?)", (rowid, blob))
        except Exception as e:
            logger.debug("rag_vectors insert: %s", e)


def index_file(source_type: str, source_id: str, path: Path, created_at: Optional[str] = None) -> int:
    """Indexeer één bestand; retourneer aantal chunks."""
    from datetime import datetime, timezone
    ts = created_at or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        logger.debug("rag index_file read %s: %s", path, e)
        return 0
    chunks = _chunk_text(text)
    if not chunks:
        return 0
    conn = _get_connection_with_vec()
    n = 0
    try:
        for i, content in enumerate(chunks):
            embedding = _embed(content)
            _insert_chunk(conn, source_type, source_id, content, embedding, ts)
            n += 1
        conn.commit()
    finally:
        conn.close()
    return n


def index_notes_from_db(created_at: Optional[str] = None) -> int:
    """Indexeer notities uit omega_db.notes."""
    import omega_db
    from datetime import datetime, timezone
    ts = created_at or datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    notes = omega_db.note_list(limit=500)
    total = 0
    conn = _get_connection_with_vec()
    try:
        for n in notes:
            content = (n.get("content") or "").strip()
            if not content:
                continue
            for chunk in _chunk_text(content):
                embedding = _embed(chunk)
                _insert_chunk(conn, "note", n.get("id", ""), chunk, embedding, ts)
                total += 1
        conn.commit()
    finally:
        conn.close()
    return total


def index_all(skip_logs: bool = False, include_notes: bool = True) -> dict:
    """
    Indexeer logs/*.log, holding/**/SOUL.md, data/souls/*.md, optioneel notes.
    Retourneer {"chunks": total, "files": n, "errors": []}.
    """
    init_rag_schema()
    total = 0
    files = 0
    errors = []
    # logs
    if not skip_logs:
        for path in (ROOT / "logs").glob("*.log"):
            try:
                n = index_file("log", path.name, path)
                total += n
                if n:
                    files += 1
            except Exception as e:
                errors.append(str(path) + ": " + str(e))
    # holding SOUL
    for path in (ROOT / "holding").rglob("SOUL.md"):
        try:
            n = index_file("soul", str(path.relative_to(ROOT)), path)
            total += n
            if n:
                files += 1
        except Exception as e:
            errors.append(str(path) + ": " + str(e))
    # data/souls
    souls_dir = ROOT / "data" / "souls"
    if souls_dir.exists():
        for path in souls_dir.glob("*.md"):
            try:
                n = index_file("soul", path.name, path)
                total += n
                if n:
                    files += 1
            except Exception as e:
                errors.append(str(path) + ": " + str(e))
    if include_notes:
        try:
            total += index_notes_from_db()
        except Exception as e:
            errors.append("notes: " + str(e))
    return {"chunks": total, "files": files, "errors": errors}


def rag_query(question: str, limit: int = 5) -> list[str]:
    """
    Zoek vergelijkbare chunks op vraag; retourneer lijst content-strings.
    Zonder sqlite-vec retourneert dit een lege lijst.
    """
    init_rag_schema()
    if not _vec_available():
        return []
    embedding = _embed(question)
    try:
        from sqlite_vec import serialize_float32
    except ImportError:
        return []
    blob = serialize_float32(embedding)
    conn = _get_connection_with_vec()
    try:
        cur = conn.execute(
            "SELECT rowid, distance FROM rag_vectors WHERE embedding MATCH ? ORDER BY distance LIMIT ?",
            (blob, limit),
        )
        rows = cur.fetchall()
        if not rows:
            return []
        rowids = [r[0] for r in rows]
        placeholders = ",".join("?" * len(rowids))
        cur = conn.execute(
            "SELECT id, content FROM rag_chunks WHERE id IN (" + placeholders + ")",
            rowids,
        )
        by_id = {r["id"]: r["content"] for r in cur.fetchall()}
        return [by_id.get(rid, "") for rid in rowids if rid in by_id]
    except sqlite3.OperationalError as e:
        if "no such table" in str(e).lower() or "vec0" in str(e).lower():
            return []
        raise
    finally:
        conn.close()


def query_memory(question: str, limit: int = 5) -> dict:
    """
    Tool-vriendelijke wrapper: vraag aan geheugen, retourneer {"ok": True, "results": [...]}.
    """
    try:
        chunks = rag_query(question, limit=limit)
        if not chunks:
            if not _vec_available():
                return {"ok": True, "results": [], "message": "RAG vereist pip install sqlite-vec. Zonder dat is er geen vectorzoeken."}
            return {"ok": True, "results": [], "message": "Geen relevante passages gevonden. Overweeg rag.index_all() uit te voeren."}
        return {"ok": True, "results": chunks, "message": f"{len(chunks)} passage(s) gevonden."}
    except Exception as e:
        logger.exception("query_memory: %s", e)
        return {"ok": False, "error": str(e), "results": []}
