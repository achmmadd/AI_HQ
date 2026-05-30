#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${MOTOR_AI_DB_PATH:-/home/pietje/AI_HQ/data/ai-motor.db}"
BACKUP_DIR="${MOTOR_AI_BACKUP_DIR:-/home/pietje/backups/motor-ai}"
DATE="$(date +%Y%m%d_%H%M%S)"
BACKUP_PATH="$BACKUP_DIR/motor-ai-$DATE.db"

if [[ ! -f "$DB_PATH" ]]; then
  echo "Database niet gevonden: $DB_PATH" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
sqlite3 "$DB_PATH" ".backup '$BACKUP_PATH'"

ls -t "$BACKUP_DIR"/*.db 2>/dev/null | tail -n +31 | xargs -r rm -f

echo "Backup klaar: $BACKUP_PATH"
