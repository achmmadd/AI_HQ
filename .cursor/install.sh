#!/usr/bin/env bash
# Idempotent setup for the active project: QwenPaw project-administratie skill.
#
# QwenPaw itself is an external agent runtime (Telegram assistant on the NUC).
# The only runnable code in this repo is the read-only `project-administratie`
# skill client, which is pure Python standard library (no pip dependencies).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SKILL_DIR="$REPO_ROOT/ai-motor/qwenpaw/skills/project-administratie"
SCRIPT="$SKILL_DIR/scripts/motor_admin.py"

# Require Python 3 (present in the default base image).
if ! command -v python3 >/dev/null 2>&1; then
  echo "install.sh: python3 not found on PATH" >&2
  exit 1
fi
python3 --version

# Byte-compile the skill client to catch syntax errors early. stdlib only.
python3 -m py_compile "$SCRIPT"
echo "install.sh: motor_admin.py compiles (stdlib only)"

# Keep the client executable for direct invocation.
chmod +x "$SCRIPT"

echo "install.sh: done"
