#!/usr/bin/env bash
# NUC-local executor (whitelisted files + commands). Bind alleen localhost.
set -euo pipefail
cd "$(dirname "$0")"
if [ -f .venv/bin/activate ]; then
  # shellcheck source=/dev/null
  source .venv/bin/activate
fi
export LOCAL_WORKSPACE_ROOT="${LOCAL_WORKSPACE_ROOT:-/home/pietje/AI_HQ/projects}"
export PATH="/home/pietje/.local/bin:${PATH}"
export LOCAL_EXECUTOR_SECRET="${LOCAL_EXECUTOR_SECRET:?Set LOCAL_EXECUTOR_SECRET}"
exec uvicorn executor_main:app --host 127.0.0.1 --port "${LOCAL_EXECUTOR_PORT:-8790}"
