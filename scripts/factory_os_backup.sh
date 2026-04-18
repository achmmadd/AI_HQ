#!/usr/bin/env bash
set -euo pipefail
set -a
# shellcheck source=/dev/null
source ~/AI_HQ/.env
set +a

BACKUP_DIR=~/AI_HQ/backups/$(date +%Y%m%d_%H%M)
mkdir -p "$BACKUP_DIR"

curl -s -X POST "http://localhost:6333/collections/factory_os/snapshots" \
  -o "$BACKUP_DIR/qdrant_factory_os_snapshot_meta.json"

if [ -n "${N8N_API_KEY:-}" ]; then
  curl -sf "http://localhost:5678/api/v1/workflows" \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -o "$BACKUP_DIR/n8n_workflows.json" || echo '{"error":"n8n export failed"}' > "$BACKUP_DIR/n8n_workflows.json"
else
  echo '{"skipped":"N8N_API_KEY not set"}' > "$BACKUP_DIR/n8n_workflows.json"
fi

cp -a ~/.openclaw "$BACKUP_DIR/openclaw_config" 2>/dev/null || true
cp ~/AI_HQ/.env.example "$BACKUP_DIR/" 2>/dev/null || true

echo "✅ Backup: $BACKUP_DIR"

if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
  export _BACKUP_LABEL="$BACKUP_DIR"
  python3 -c "
import json, os, urllib.request
token = os.environ['TELEGRAM_BOT_TOKEN']
chat = os.environ['TELEGRAM_CHAT_ID']
body = json.dumps({
    'chat_id': chat,
    'text': '✅ Factory OS backup: ' + os.environ.get('_BACKUP_LABEL',''),
}).encode()
req = urllib.request.Request(
    f'https://api.telegram.org/bot{token}/sendMessage',
    data=body,
    headers={'Content-Type': 'application/json'},
    method='POST',
)
with urllib.request.urlopen(req) as r:
    d = json.load(r)
assert d.get('ok'), d
" || true
fi
