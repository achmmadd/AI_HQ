#!/usr/bin/env python3
"""Ingesteer markdown uit factory-os/klanten/*/kennisbank naar Qdrant factory_os via Ollama embeddings."""
import json
import sys
import urllib.request
from pathlib import Path

OLLAMA = "http://127.0.0.1:11434"
QDRANT = "http://127.0.0.1:6333"
MODEL = "nomic-embed-text"
COLLECTION = "factory_os"
AI_HQ = Path.home() / "AI_HQ"
MAX_CHARS = 6000
MAX_FILES = 20


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


def main() -> None:
    roots = list(AI_HQ.glob("factory-os/klanten/*/kennisbank"))
    if not roots:
        print("Geen kennisbank-mappen gevonden", file=sys.stderr)
        sys.exit(1)
    points = []
    pid = 1
    for kb in roots:
        client = kb.parent.name  # fumero, bokas, ...
        for path in sorted(kb.glob("*.md"))[:MAX_FILES]:
            text = path.read_text(encoding="utf-8", errors="replace")[:MAX_CHARS]
            if len(text.strip()) < 50:
                continue
            vec = embed(text)
            points.append(
                {
                    "id": pid,
                    "vector": vec,
                    "payload": {
                        "client": client,
                        "source": path.name,
                        "text": text[:2000],
                    },
                }
            )
            print(f"embedded {pid}: {client}/{path.name} dim={len(vec)}")
            pid += 1
    if not points:
        print("Geen punten om te upserten", file=sys.stderr)
        sys.exit(1)
    body = json.dumps({"points": points}).encode()
    req = urllib.request.Request(
        f"{QDRANT}/collections/{COLLECTION}/points?wait=true",
        data=body,
        headers={"Content-Type": "application/json"},
        method="PUT",
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        print("Qdrant:", r.read().decode()[:500])


if __name__ == "__main__":
    main()
