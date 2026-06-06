#!/usr/bin/env bash
# NUC-local executor (whitelisted files + commands). Bind alleen localhost.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

export LOCAL_WORKSPACE_ROOT="${LOCAL_WORKSPACE_ROOT:-/home/pietje/AI_HQ/projects}"
export PATH="/home/pietje/.local/bin:${PATH}"
export LOCAL_EXECUTOR_SECRET="${LOCAL_EXECUTOR_SECRET:?Set LOCAL_EXECUTOR_SECRET}"

UVICORN="$ROOT/.venv/bin/uvicorn"
if [[ ! -x "$UVICORN" ]]; then
  echo "run_executor.sh: missing $UVICORN — run: python3 -m venv .venv && .venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi

exec "$UVICORN" executor_main:app --host 127.0.0.1 --port "${LOCAL_EXECUTOR_PORT:-8790}"
