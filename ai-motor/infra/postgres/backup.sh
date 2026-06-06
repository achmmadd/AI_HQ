#!/usr/bin/env bash
# Daily Postgres backup for Motor AI Factory OS.
# Cron example (Hetzner): 0 3 * * * /opt/motor/infra/postgres/backup.sh >> /var/log/motor-pg-backup.log 2>&1
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/motor-postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a && source "$ENV_FILE" && set +a
fi

POSTGRES_USER="${POSTGRES_USER:-motor}"
POSTGRES_DB="${POSTGRES_DB:-motor_ai}"
CONTAINER="${POSTGRES_CONTAINER:-motor-postgres}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/${POSTGRES_DB}_${STAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

docker exec "$CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl \
  | gzip -9 > "$OUT"

find "$BACKUP_DIR" -name "${POSTGRES_DB}_*.sql.gz" -mtime +"$RETENTION_DAYS" -delete

echo "[motor-pg-backup] OK $OUT ($(du -h "$OUT" | cut -f1))"
