#!/bin/sh
# Omega Core: start Telegram Bridge + Engineer in één container (1Panel Singularity).
set -e
cd /app
python3 -c "import telegram_bridge" 2>/dev/null || true
python3 scripts/engineer_daemon.py &
exec python3 telegram_bridge.py
