#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
export ENV_SRC="${AGENT_SERVICE_ENV_FILE:-/home/pietje/AI_HQ/ai-motor/.env.local}"
eval "$(.venv/bin/python -c '
import os, shlex
from pathlib import Path
from dotenv import dotenv_values
p = Path(os.environ.get("ENV_SRC",""))
vals = dotenv_values(p) if p.exists() else {}
for k in ("BROWSERBASE_API_KEY","BROWSERBASE_PROJECT_ID","OLLAMA_URL","OLLAMA_BASE_URL","OLLAMA_MODEL"):
    v = (vals.get(k) or "").strip()
    if v:
        print(f"export {k}={shlex.quote(v)}")
ob = (vals.get("OLLAMA_BASE_URL") or "").strip() or (vals.get("OLLAMA_URL") or "").strip()
if ob:
    print(f"export OLLAMA_BASE_URL={shlex.quote(ob)}")
' )"
export OLLAMA_MODEL="${OLLAMA_MODEL:-qwen3:4b}"
export AGENT_USE_VISION="${AGENT_USE_VISION:-false}"
exec "$(dirname "$0")/.venv/bin/uvicorn" main:app --host 0.0.0.0 --port 8787
