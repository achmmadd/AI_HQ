#!/usr/bin/env python3
"""Ingesteer markdown uit factory-os/klanten/*/kennisbank naar scoped Qdrant buckets via Ollama embeddings.

SSOT (ai-motor/lib/qdrant-collection.ts): per-klant ingest bucket `{prefix}_{klant}` (default factory_os_fumero).
Legacy `factory_os` zonder suffix is alleen voor migratie — niet voor nieuwe writes.

Canonical copy for ai-motor; legacy path AI_HQ/scripts/qdrant_ingest_kennisbank.py may need root to update.
"""
import json
import os
import sys
import urllib.error
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

OLLAMA = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
QDRANT = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333").rstrip("/")
MODEL = os.environ.get("OLLAMA_EMBED_MODEL", "nomic-embed-text")
PREFIX = (os.environ.get("QDRANT_COLLECTION_PREFIX") or "factory_os").strip("/") or "factory_os"
LEGACY_COLLECTION = (os.environ.get("QDRANT_COLLECTION") or "factory_os").strip("/") or "factory_os"
AI_HQ = Path.home() / "AI_HQ"
MAX_CHARS = 6000
MAX_FILES = 20
SCOPED_CLIENTS = {"fumero", "bokas", "motor"}


def normalize_klant(name: str) -> str:
    k = (name or "").strip().lower()
    if k in SCOPED_CLIENTS:
        return k
    return "motor"


def ingest_collection_for_klant(klant: str) -> str:
    return f"{PREFIX}_{normalize_klant(klant)}"


def embed(text: str) -> list:
    for attempt in (text, text[:3000], text[:1000]):
        if len(attempt.strip()) < 10:
            continue
        body = json.dumps({"model": MODEL, "prompt": attempt}).encode()
        req = urllib.request.Request(
            f"{OLLAMA}/api/embeddings",
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                data = json.load(r)
            return data["embedding"]
        except urllib.error.HTTPError as e:
            if e.code != 500:
                raise
    raise RuntimeError("embed failed after truncates")


def ensure_collection(name: str, vector_size: int) -> None:
    req = urllib.request.Request(
        f"{QDRANT}/collections/{name}",
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            if r.status == 200:
                return
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise

    body = json.dumps(
        {"vectors": {"size": vector_size, "distance": "Cosine"}}
    ).encode()
    req = urllib.request.Request(
        f"{QDRANT}/collections/{name}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="PUT",
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        print(f"created collection {name} (dim={vector_size})", file=sys.stderr)


def upsert_points(collection: str, points: list) -> None:
    body = json.dumps({"points": points}).encode()
    req = urllib.request.Request(
        f"{QDRANT}/collections/{collection}/points?wait=true",
        data=body,
        headers={"Content-Type": "application/json"},
        method="PUT",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        print(f"Qdrant upsert {collection}: {r.read().decode()[:300]}")


def main() -> None:
    if LEGACY_COLLECTION == PREFIX and LEGACY_COLLECTION not in (
        f"{PREFIX}_fumero",
        f"{PREFIX}_bokas",
    ):
        print(
            f"[qdrant:ingest] QDRANT_COLLECTION={LEGACY_COLLECTION} is legacy-only; "
            f"writes target {PREFIX}_{{klant}}. "
            f"Run ai-motor/scripts/qdrant-migrate-collections.mjs if data still lives in {LEGACY_COLLECTION}.",
            file=sys.stderr,
        )

    roots = list(AI_HQ.glob("factory-os/klanten/*/kennisbank"))
    if not roots:
        print("Geen kennisbank-mappen gevonden", file=sys.stderr)
        sys.exit(1)

    by_collection: dict[str, list] = defaultdict(list)
    pid = 1

    for kb in roots:
        client = kb.parent.name  # fumero, bokas, ...
        collection = ingest_collection_for_klant(client)
        print(
            f"[qdrant:ingest] klant={client} → collection={collection} "
            f"(legacy={LEGACY_COLLECTION}, search also uses scrape bucket per ADR-001)",
            file=sys.stderr,
        )

        for path in sorted(kb.glob("*.md"))[:MAX_FILES]:
            text = path.read_text(encoding="utf-8", errors="replace")[:MAX_CHARS]
            if len(text.strip()) < 50:
                continue
            vec = embed(text)
            by_collection[collection].append(
                {
                    "id": pid,
                    "vector": vec,
                    "payload": {
                        "client": normalize_klant(client),
                        "source": path.name,
                        "text": text[:2000],
                        "ingested_at": datetime.now(timezone.utc)
                        .replace(microsecond=0)
                        .isoformat()
                        .replace("+00:00", "Z"),
                    },
                }
            )
            print(f"embedded {pid}: {client}/{path.name} → {collection} dim={len(vec)}")
            pid += 1

    if not by_collection:
        print("Geen punten om te upserten", file=sys.stderr)
        sys.exit(1)

    for collection, points in by_collection.items():
        if collection == LEGACY_COLLECTION:
            print(
                f"[qdrant:ingest] WARN: refusing legacy-only bucket {LEGACY_COLLECTION}; "
                f"use {PREFIX}_{{klant}} instead",
                file=sys.stderr,
            )
            sys.exit(2)
        ensure_collection(collection, len(points[0]["vector"]))
        upsert_points(collection, points)
        print(f"✓ {len(points)} punten in {collection}")


if __name__ == "__main__":
    main()
