"""
Omega AI-Holding — Centraal SQLite-zenuwstelsel.
Eén database (data/omega.db) voor missions, state, tasks, notes, approvals, heartbeat.
PRAGMA journal_mode=WAL op elke connectie voor gelijktijdige toegang.
"""
import json
import logging
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Optional

ROOT = Path(__file__).resolve().parent
DATABASE_PATH = Path(__file__).resolve().parent / "data" / "omega.db"
# TODO: SQLCipher in Fase 1+ (sqlcipher3, PRAGMA key via OMEGA_DB_KEY env var)
MIGRATIONS_DIR = ROOT / "migrations"
logger = logging.getLogger(__name__)


def _apply_pragmas(conn: sqlite3.Connection) -> None:
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
    conn.execute("PRAGMA foreign_keys=ON;")


@contextmanager
def get_connection():
    """Sync context manager voor database-connectie. WAL op elke connectie."""
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DATABASE_PATH))
    conn.row_factory = sqlite3.Row
    _apply_pragmas(conn)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_schema() -> None:
    """Maak alle tabellen aan indien ze nog niet bestaan."""
    with get_connection() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS missions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'QUEUED',
                assigned_specialist TEXT NOT NULL DEFAULT 'shuri',
                source TEXT DEFAULT 'telegram',
                payload TEXT,
                result TEXT,
                progress REAL NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_missions_status ON missions(status);
            CREATE INDEX IF NOT EXISTS idx_missions_updated ON missions(updated_at);

            CREATE TABLE IF NOT EXISTS mission_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                description TEXT NOT NULL,
                prioriteit TEXT NOT NULL DEFAULT 'normaal',
                status TEXT NOT NULL DEFAULT 'open',
                created TEXT NOT NULL,
                completed TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

            CREATE TABLE IF NOT EXISTS notes (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_notes_created ON notes(created_at);

            CREATE TABLE IF NOT EXISTS pending_approvals (
                chat_id TEXT PRIMARY KEY,
                approval_id TEXT NOT NULL,
                description TEXT NOT NULL,
                action TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS heartbeat_history (
                ts INTEGER NOT NULL,
                ok INTEGER NOT NULL DEFAULT 1
            );
            CREATE INDEX IF NOT EXISTS idx_heartbeat_ts ON heartbeat_history(ts);
        """)
        _run_holding_migrations(conn)


# ——— Missions ———

def missions_get_all() -> list[dict]:
    with get_connection() as conn:
        cur = conn.execute("SELECT id, title, status, assigned_specialist, source, payload, result, progress, created_at, updated_at FROM missions ORDER BY updated_at DESC")
        return [_row_to_mission(dict(r)) for r in cur.fetchall()]


def _row_to_mission(row: dict) -> dict:
    out = dict(row)
    if out.get("payload"):
        try:
            out["payload"] = json.loads(out["payload"])
        except (TypeError, json.JSONDecodeError):
            out["payload"] = {}
    return out


def mission_insert(mid: str, title: str, status: str, assigned_specialist: str, source: str, payload: dict | None, created_at: str, updated_at: str) -> None:
    with get_connection() as conn:
        conn.execute(
            """INSERT INTO missions (id, title, status, assigned_specialist, source, payload, result, progress, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?, ?)""",
            (mid, title[:500], status, assigned_specialist, source, json.dumps(payload or {}), created_at, updated_at),
        )


def mission_update_status(mission_id: str, status: str, result: Optional[str] = None, progress: Optional[float] = None, updated_at: str = "") -> bool:
    import datetime
    from datetime import timezone
    ts = updated_at or datetime.datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    with get_connection() as conn:
        if result is not None and progress is not None:
            conn.execute("UPDATE missions SET status = ?, result = ?, progress = ?, updated_at = ? WHERE id = ?", (status, result, progress, ts, mission_id))
        elif progress is not None:
            conn.execute("UPDATE missions SET status = ?, progress = ?, updated_at = ? WHERE id = ?", (status, max(0, min(1, progress)), ts, mission_id))
        else:
            conn.execute("UPDATE missions SET status = ?, updated_at = ? WHERE id = ?", (status, ts, mission_id))
        return conn.total_changes > 0


def mission_update_specialist(mission_id: str, specialist: str, updated_at: str = "") -> bool:
    import datetime
    from datetime import timezone
    ts = updated_at or datetime.datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    with get_connection() as conn:
        conn.execute("UPDATE missions SET assigned_specialist = ?, updated_at = ? WHERE id = ?", (specialist.lower(), ts, mission_id))
        return conn.total_changes > 0


def mission_update_progress(mission_id: str, progress: float, updated_at: str = "") -> bool:
    import datetime
    from datetime import timezone
    ts = updated_at or datetime.datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    p = max(0.0, min(1.0, progress))
    with get_connection() as conn:
        conn.execute("UPDATE missions SET progress = ?, updated_at = ? WHERE id = ?", (p, ts, mission_id))
        return conn.total_changes > 0


# ——— Mission state (key-value) ———

def state_get(key: str, default: Any = None) -> Any:
    with get_connection() as conn:
        cur = conn.execute("SELECT value FROM mission_state WHERE key = ?", (key,))
        row = cur.fetchone()
        if row is None:
            return default
        val = row[0]
        try:
            return json.loads(val)
        except (TypeError, json.JSONDecodeError):
            return val


def state_set(key: str, value: Any) -> None:
    s = value if isinstance(value, str) else json.dumps(value)
    with get_connection() as conn:
        conn.execute("INSERT OR REPLACE INTO mission_state (key, value) VALUES (?, ?)", (key, s))


def state_get_all() -> dict:
    with get_connection() as conn:
        cur = conn.execute("SELECT key, value FROM mission_state")
        out = {}
        for row in cur.fetchall():
            k, v = row[0], row[1]
            try:
                out[k] = json.loads(v)
            except (TypeError, json.JSONDecodeError):
                out[k] = v
        return out


# ——— Tasks ———

def task_insert(task_id: str, description: str, prioriteit: str, status: str, created: str, completed: Optional[str] = None) -> None:
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO tasks (id, description, prioriteit, status, created, completed) VALUES (?, ?, ?, ?, ?, ?)",
            (task_id, description, prioriteit, status, created, completed),
        )


def task_list(status: str = "open", limit: int = 50) -> list[dict]:
    with get_connection() as conn:
        if status == "alle":
            cur = conn.execute("SELECT id, description, prioriteit, status, created, completed FROM tasks ORDER BY created DESC LIMIT ?", (limit,))
        else:
            cur = conn.execute("SELECT id, description, prioriteit, status, created, completed FROM tasks WHERE status = ? ORDER BY created DESC LIMIT ?", (status, limit))
        return [dict(r) for r in cur.fetchall()]


def task_complete(task_id: str, completed: str) -> bool:
    with get_connection() as conn:
        conn.execute("UPDATE tasks SET status = 'done', completed = ? WHERE id = ?", (completed, task_id))
        return conn.total_changes > 0


# ——— Notes ———

def note_insert(note_id: str, title: str, content: str, created_at: str) -> None:
    with get_connection() as conn:
        conn.execute("INSERT INTO notes (id, title, content, created_at) VALUES (?, ?, ?, ?)", (note_id, title, content, created_at))


def note_list(limit: int = 10) -> list[dict]:
    with get_connection() as conn:
        cur = conn.execute("SELECT id, title, content, created_at FROM notes ORDER BY created_at DESC LIMIT ?", (limit,))
        return [dict(r) for r in cur.fetchall()]


def note_get(note_id: str) -> Optional[dict]:
    with get_connection() as conn:
        cur = conn.execute("SELECT id, title, content, created_at FROM notes WHERE id = ?", (note_id,))
        row = cur.fetchone()
        return dict(row) if row else None


# ——— Pending approvals ———

def approval_get_by_chat(chat_id: str) -> Optional[dict]:
    with get_connection() as conn:
        cur = conn.execute("SELECT chat_id, approval_id, description, action, created_at FROM pending_approvals WHERE chat_id = ?", (str(chat_id),))
        row = cur.fetchone()
        if not row:
            return None
        r = dict(row)
        try:
            r["action"] = json.loads(r["action"])
        except (TypeError, json.JSONDecodeError):
            pass
        return r


def approval_set(chat_id: str, approval_id: str, description: str, action: dict, created_at: str) -> None:
    with get_connection() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO pending_approvals (chat_id, approval_id, description, action, created_at) VALUES (?, ?, ?, ?, ?)",
            (str(chat_id), approval_id, description, json.dumps(action), created_at),
        )


def approval_remove(chat_id: str) -> None:
    with get_connection() as conn:
        conn.execute("DELETE FROM pending_approvals WHERE chat_id = ?", (str(chat_id),))


# ——— Heartbeat ———

def heartbeat_append(ts: int, ok: int = 1) -> None:
    max_rows = 24 * 60
    with get_connection() as conn:
        conn.execute("INSERT INTO heartbeat_history (ts, ok) VALUES (?, ?)", (ts, ok))
        cur = conn.execute("SELECT COUNT(*) FROM heartbeat_history")
        n = cur.fetchone()[0]
        if n > max_rows:
            cur = conn.execute("SELECT ts FROM heartbeat_history ORDER BY ts ASC LIMIT ?", (n - max_rows,))
            to_delete = [r[0] for r in cur.fetchall()]
            if to_delete:
                conn.executemany("DELETE FROM heartbeat_history WHERE ts = ?", [(t,) for t in to_delete])


def heartbeat_last_ts() -> Optional[int]:
    with get_connection() as conn:
        cur = conn.execute("SELECT ts FROM heartbeat_history ORDER BY ts DESC LIMIT 1")
        row = cur.fetchone()
        return int(row[0]) if row else None


def heartbeat_list(limit: int = 24 * 60) -> list[dict]:
    """Recent heartbeat points for dashboard (ts, ok)."""
    with get_connection() as conn:
        cur = conn.execute("SELECT ts, ok FROM heartbeat_history ORDER BY ts DESC LIMIT ?", (limit,))
        return [{"ts": r[0], "ok": r[1]} for r in cur.fetchall()]


# ——— Holding migraties ———

def _run_holding_migrations(conn: sqlite3.Connection) -> None:
    """Voer holding migratie-SQL uit (idempotent via CREATE IF NOT EXISTS)."""
    migration_file = MIGRATIONS_DIR / "001_holding_tables.sql"
    if not migration_file.exists():
        return
    try:
        sql = migration_file.read_text(encoding="utf-8")
        conn.executescript(sql)
    except Exception as e:
        logger.warning("Holding migratie overgeslagen: %s", e)


# ——— Tenants ———

def tenant_insert(tenant_id: str, name: str, tenant_type: str,
                  brand_voice: str = "", target_audience: str = "",
                  industry: str = "", config: dict | None = None) -> None:
    with get_connection() as conn:
        conn.execute(
            """INSERT OR IGNORE INTO tenants
               (id, name, type, brand_voice, target_audience, industry, config)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (tenant_id, name, tenant_type, brand_voice, target_audience,
             industry, json.dumps(config or {})),
        )


def tenant_get(tenant_id: str) -> Optional[dict]:
    with get_connection() as conn:
        cur = conn.execute("SELECT * FROM tenants WHERE id = ?", (tenant_id,))
        row = cur.fetchone()
        return dict(row) if row else None


def tenant_list() -> list[dict]:
    with get_connection() as conn:
        cur = conn.execute("SELECT * FROM tenants ORDER BY name")
        return [dict(r) for r in cur.fetchall()]


# ——— Holding agents ———

def holding_agent_insert(agent_id: str, tenant_id: str, name: str, role: str,
                         specialization: str = "", skills: list | None = None,
                         model: str = "gemini", parent_agent_id: str | None = None,
                         confidence_threshold: float = 0.8,
                         system_prompt: str = "") -> None:
    with get_connection() as conn:
        conn.execute(
            """INSERT OR IGNORE INTO holding_agents
               (id, tenant_id, name, role, specialization, skills, model,
                status, parent_agent_id, confidence_threshold, system_prompt)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'idle', ?, ?, ?)""",
            (agent_id, tenant_id, name, role, specialization,
             json.dumps(skills or []), model, parent_agent_id,
             confidence_threshold, system_prompt),
        )


def holding_agent_get(agent_id: str) -> Optional[dict]:
    with get_connection() as conn:
        cur = conn.execute("SELECT * FROM holding_agents WHERE id = ?", (agent_id,))
        row = cur.fetchone()
        if not row:
            return None
        d = dict(row)
        try:
            d["skills"] = json.loads(d["skills"])
        except (TypeError, json.JSONDecodeError):
            d["skills"] = []
        return d


def holding_agent_list(tenant_id: str | None = None) -> list[dict]:
    with get_connection() as conn:
        if tenant_id:
            cur = conn.execute(
                "SELECT * FROM holding_agents WHERE tenant_id = ? ORDER BY role, name",
                (tenant_id,))
        else:
            cur = conn.execute("SELECT * FROM holding_agents ORDER BY tenant_id, role, name")
        out = []
        for r in cur.fetchall():
            d = dict(r)
            try:
                d["skills"] = json.loads(d["skills"])
            except (TypeError, json.JSONDecodeError):
                d["skills"] = []
            out.append(d)
        return out


def holding_agent_set_status(agent_id: str, status: str) -> bool:
    with get_connection() as conn:
        conn.execute(
            "UPDATE holding_agents SET status = ? WHERE id = ?", (status, agent_id))
        return conn.total_changes > 0


# ——— Holding tasks ———

def holding_task_insert(task_id: str, tenant_id: str, task_type: str,
                        title: str, description: str = "",
                        assigned_to: str | None = None,
                        created_by: str | None = None,
                        input_data: dict | None = None,
                        priority: int = 5, max_revisions: int = 3) -> None:
    with get_connection() as conn:
        conn.execute(
            """INSERT INTO holding_tasks
               (id, tenant_id, assigned_to, created_by, type, title, description,
                input_data, status, priority, revision_count, max_revisions)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0, ?)""",
            (task_id, tenant_id, assigned_to, created_by, task_type, title,
             description, json.dumps(input_data or {}), priority, max_revisions),
        )


def holding_task_get(task_id: str) -> Optional[dict]:
    with get_connection() as conn:
        cur = conn.execute("SELECT * FROM holding_tasks WHERE id = ?", (task_id,))
        row = cur.fetchone()
        if not row:
            return None
        return _parse_holding_task(dict(row))


def holding_task_list(tenant_id: str | None = None, status: str | None = None,
                      assigned_to: str | None = None, limit: int = 50) -> list[dict]:
    with get_connection() as conn:
        clauses, params = [], []
        if tenant_id:
            clauses.append("tenant_id = ?"); params.append(tenant_id)
        if status:
            clauses.append("status = ?"); params.append(status)
        if assigned_to:
            clauses.append("assigned_to = ?"); params.append(assigned_to)
        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        cur = conn.execute(
            f"SELECT * FROM holding_tasks {where} ORDER BY created_at DESC LIMIT ?",
            (*params, limit))
        return [_parse_holding_task(dict(r)) for r in cur.fetchall()]


def holding_task_update_status(task_id: str, status: str,
                               output_data: dict | None = None,
                               confidence_score: float | None = None) -> bool:
    with get_connection() as conn:
        sets = ["status = ?"]
        params: list[Any] = [status]
        if output_data is not None:
            sets.append("output_data = ?"); params.append(json.dumps(output_data))
        if confidence_score is not None:
            sets.append("confidence_score = ?"); params.append(confidence_score)
        if status == "approved":
            from datetime import datetime as _dt, timezone as _tz
            sets.append("approved_at = ?")
            params.append(_dt.now(_tz.utc).isoformat().replace("+00:00", "Z"))
        params.append(task_id)
        conn.execute(
            f"UPDATE holding_tasks SET {', '.join(sets)} WHERE id = ?", params)
        return conn.total_changes > 0


def holding_task_increment_revision(task_id: str, review_notes: str = "",
                                    reviewed_by: str | None = None,
                                    confidence_score: float | None = None) -> bool:
    with get_connection() as conn:
        sets = ["revision_count = revision_count + 1",
                "review_notes = ?", "reviewed_by = ?", "status = 'pending'"]
        params: list[Any] = [review_notes, reviewed_by]
        if confidence_score is not None:
            sets.append("confidence_score = ?")
            params.append(confidence_score)
        params.append(task_id)
        conn.execute(
            f"UPDATE holding_tasks SET {', '.join(sets)} WHERE id = ?",
            params)
        return conn.total_changes > 0


def _parse_holding_task(d: dict) -> dict:
    for field in ("input_data", "output_data"):
        if d.get(field):
            try:
                d[field] = json.loads(d[field])
            except (TypeError, json.JSONDecodeError):
                pass
    return d


# ——— Corrections ———

def correction_insert(task_id: str, reviewer_agent_id: str,
                      original_output: str = "", correction: str = "",
                      reason: str = "", severity: str = "minor") -> int:
    with get_connection() as conn:
        cur = conn.execute(
            """INSERT INTO corrections
               (task_id, reviewer_agent_id, original_output, correction, reason, severity)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (task_id, reviewer_agent_id, original_output, correction, reason, severity))
        return cur.lastrowid or 0


def correction_list(task_id: str) -> list[dict]:
    with get_connection() as conn:
        cur = conn.execute(
            "SELECT * FROM corrections WHERE task_id = ? ORDER BY created_at DESC",
            (task_id,))
        return [dict(r) for r in cur.fetchall()]


# ——— Cost log ———

def cost_log_insert(tenant_id: str, agent_id: str, model_used: str = "",
                    tokens_in: int = 0, tokens_out: int = 0,
                    cost_usd: float = 0.0, task_id: str | None = None) -> None:
    with get_connection() as conn:
        conn.execute(
            """INSERT INTO cost_log
               (tenant_id, agent_id, model_used, tokens_in, tokens_out, cost_usd, task_id)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (tenant_id, agent_id, model_used, tokens_in, tokens_out, cost_usd, task_id))


def cost_log_summary(tenant_id: str | None = None) -> list[dict]:
    with get_connection() as conn:
        if tenant_id:
            cur = conn.execute(
                """SELECT tenant_id, agent_id, model_used,
                          SUM(tokens_in) as total_in, SUM(tokens_out) as total_out,
                          SUM(cost_usd) as total_cost, COUNT(*) as call_count
                   FROM cost_log WHERE tenant_id = ?
                   GROUP BY tenant_id, agent_id, model_used""",
                (tenant_id,))
        else:
            cur = conn.execute(
                """SELECT tenant_id, agent_id, model_used,
                          SUM(tokens_in) as total_in, SUM(tokens_out) as total_out,
                          SUM(cost_usd) as total_cost, COUNT(*) as call_count
                   FROM cost_log
                   GROUP BY tenant_id, agent_id, model_used""")
        return [dict(r) for r in cur.fetchall()]


# ——— Holding audit ———

def holding_audit_log(action: str, tenant_id: str | None = None,
                      agent_id: str | None = None,
                      details: dict | None = None) -> None:
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO holding_audit (tenant_id, agent_id, action, details) VALUES (?, ?, ?, ?)",
            (tenant_id, agent_id, action, json.dumps(details or {})))
