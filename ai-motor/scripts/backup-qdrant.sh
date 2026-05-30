#!/usr/bin/env bash
set -euo pipefail

QDRANT_URL="${QDRANT_URL:-http://127.0.0.1:6333}"
BACKUP_DIR="${QDRANT_BACKUP_DIR:-/home/pietje/backups/qdrant}"
DATE="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR"

COLLECTIONS="$(curl -fsS "$QDRANT_URL/collections" | jq -r '.result.collections[].name')"

if [[ -z "$COLLECTIONS" ]]; then
  echo "Geen Qdrant collecties gevonden."
  exit 0
fi

while IFS= read -r COLLECTION; do
  [[ -z "$COLLECTION" ]] && continue

  SNAPSHOT_NAME="$(
    curl -fsS -X POST "$QDRANT_URL/collections/$COLLECTION/snapshots" |
      jq -r '.result.name'
  )"

  if [[ -z "$SNAPSHOT_NAME" || "$SNAPSHOT_NAME" == "null" ]]; then
    echo "Snapshot aanmaken mislukt voor $COLLECTION" >&2
    exit 1
  fi

  curl -fsS \
    "$QDRANT_URL/collections/$COLLECTION/snapshots/$SNAPSHOT_NAME" \
    -o "$BACKUP_DIR/${COLLECTION}-$DATE.snapshot"

  echo "Snapshot: $COLLECTION"
done <<< "$COLLECTIONS"
