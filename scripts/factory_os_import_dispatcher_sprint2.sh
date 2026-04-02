#!/usr/bin/env bash
# Importeert factory_os_dispatcher.json en zet de nieuwste "Factory OS | MVP Dispatcher" actief.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WF="$ROOT/factory-os/systeem/n8n-workflows/factory_os_dispatcher.json"
LABEL="Factory OS | MVP Dispatcher"

if ! docker inspect n8n >/dev/null 2>&1; then
  echo "Geen container 'n8n'. Start: cd $ROOT && docker compose -f docker-compose.ai_hq.yml up -d"
  exit 1
fi
if [[ ! -f "$WF" ]]; then
  echo "Ontbreekt: $WF"
  exit 1
fi

docker cp "$WF" n8n:/tmp/factory_os_dispatcher.json
docker exec n8n n8n import:workflow --input=/tmp/factory_os_dispatcher.json

mapfile -t LINES < <(docker exec n8n n8n list:workflow 2>/dev/null | grep -F "$LABEL" || true)
if [[ ${#LINES[@]} -eq 0 ]]; then
  echo "Geen workflow met naam '$LABEL' gevonden na import."
  exit 1
fi

NEW_ID="${LINES[-1]%%|*}"
if [[ -z "$NEW_ID" ]]; then
  echo "Kon workflow-id niet parsen."
  exit 1
fi

for line in "${LINES[@]}"; do
  oid="${line%%|*}"
  [[ "$oid" == "$NEW_ID" ]] && continue
  [[ -z "$oid" ]] && continue
  docker exec n8n n8n update:workflow --id="$oid" --active=false 2>/dev/null || true
done

docker exec n8n n8n update:workflow --id="$NEW_ID" --active=true 2>/dev/null || true
docker exec n8n n8n publish:workflow --id="$NEW_ID" 2>/dev/null || true

echo "Actief gezet: $NEW_ID ($LABEL). Herstart n8n:"
echo "  docker restart n8n"
echo "Benodigd in .env: OPENAI_API_KEY of OPTIMUS_API_KEY, DIFY_AGENT_API_KEY, FACTORY_OS_DIFY_API_BASE (of DIFY_API_BASE)."
echo "Test: curl -s -X POST http://127.0.0.1:5678/webhook/factory-os -H 'Content-Type: application/json' -d '{\"prompt\":\"test\",\"klant\":\"fumero\"}'"
