#!/usr/bin/env python3
"""Lees AI_HQ/.env, maak QdrantClient, print get_collections() — zelfde patroon als qdrant_client SDK.

Gebruik:
  cd ~/AI_HQ && ./venv/bin/python scripts/qdrant_smoke.py
  # of: pip install qdrant-client && python3 scripts/qdrant_smoke.py

Vereist: QDRANT_URL (of QDRANT_CLUSTER_ENDPOINT) + QDRANT_API_KEY in .env
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

_REPO = Path(__file__).resolve().parents[1]


def _load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, _, v = s.partition("=")
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v


def main() -> int:
    _load_env_file(_REPO / ".env")
    if str(_REPO) not in sys.path:
        sys.path.insert(0, str(_REPO))
    try:
        from openclaw.logic.qdrant_cloud import get_qdrant_client
    except ImportError as e:
        print("Kan openclaw.logic.qdrant_cloud niet importeren:", e, file=sys.stderr)
        return 2
    try:
        client = get_qdrant_client()
    except ValueError as e:
        print(e, file=sys.stderr)
        return 2
    except ImportError:
        print("Installeer: pip install qdrant-client", file=sys.stderr)
        return 2
    print(client.get_collections())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
