#!/usr/bin/env bash
# Delegates to canonical ai-motor ingest script (scoped buckets: factory_os_{klant}).
# Legacy AI_HQ/scripts/qdrant_ingest_kennisbank.py is root-owned; use this wrapper instead.
set -euo pipefail
exec python3 "${HOME}/AI_HQ/ai-motor/scripts/qdrant_ingest_kennisbank.py" "$@"
