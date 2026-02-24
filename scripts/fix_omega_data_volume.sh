#!/usr/bin/env bash
# Fix: Docker volume ai_hq_omega_data bevat 'knowledge_base' als bestand of conflict.
# Dan faalt: mkdir ... knowledge_base: file exists
# Dit script ruimt dat op zodat de volume weer bruikbaar is.
set -e
VOL="${1:-ai_hq_omega_data}"
echo "Volume fix: $VOL (knowledge_base conflict)"
docker run --rm -v "${VOL}:/data" alpine sh -c '
  if [ -f /data/knowledge_base ]; then
    echo "Verwijderen bestand /data/knowledge_base"
    rm -f /data/knowledge_base
  fi
  mkdir -p /data/knowledge_base
  echo "OK: /data/knowledge_base is nu een directory"
'
echo "Klaar. Start opnieuw: docker compose --profile with-tunnel up -d"
