#!/usr/bin/env bash
# Sprint 5: import dispatcher (multi-Dify), bibliothecaris (+ Telegram), ping — nieuwste actief, oude duplicaten uit.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
N8N_DIR="$ROOT/factory-os/systeem/n8n-workflows"

if ! docker inspect n8n >/dev/null 2>&1; then
  echo "Geen container 'n8n'. Start: cd $ROOT && docker compose up -d"
  exit 1
fi

import_activate() {
  local label="$1" file="$2"
  local base
  base="$(basename "$file")"
  if [[ ! -f "$file" ]]; then
    echo "Ontbreekt: $file"
    exit 1
  fi
  docker cp "$file" "n8n:/tmp/$base"
  docker exec n8n n8n import:workflow --input="/tmp/$base"
  mapfile -t lines < <(docker exec n8n n8n list:workflow 2>/dev/null | grep -F "$label" || true)
  if [[ ${#lines[@]} -eq 0 ]]; then
    echo "Geen workflow gevonden met naam '$label' na import."
    exit 1
  fi
  new_id="${lines[-1]%%|*}"
  if [[ -z "$new_id" ]]; then
    echo "Kon id niet parsen voor $label"
    exit 1
  fi
  for line in "${lines[@]}"; do
    oid="${line%%|*}"
    [[ "$oid" == "$new_id" ]] && continue
    [[ -z "$oid" ]] && continue
    docker exec n8n n8n update:workflow --id="$oid" --active=false 2>/dev/null || true
  done
  docker exec n8n n8n update:workflow --id="$new_id" --active=true 2>/dev/null || true
  docker exec n8n n8n publish:workflow --id="$new_id" 2>/dev/null || true
  echo "Actief: $new_id — $label"
}

import_activate "Factory OS | MVP Dispatcher" "$N8N_DIR/factory_os_dispatcher.json"
import_activate "Factory OS | Bibliothecaris (Fumero startset)" "$N8N_DIR/factory_os_bibliothecaris.json"
import_activate "Factory OS | Ping" "$N8N_DIR/factory_os_ping.json"

echo ""
echo "Herstart n8n zodat webhooks zeker geregistreerd zijn:"
echo "  docker restart n8n"
echo ""
echo "Daarna: ~/AI_HQ/scripts/factory_os_finale_test.sh"
