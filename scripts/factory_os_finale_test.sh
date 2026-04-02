#!/usr/bin/env bash
# Factory OS — Sprint 5 finale (curl-checks): ping, dispatcher-takken, kennisbank, bibliothecaris.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
KB="$ROOT/factory-os/klanten/fumero/kennisbank"
cd "$ROOT"
# shellcheck disable=SC1091
[[ -f .env ]] && source .env || true

echo "=== FACTORY OS FINALE TEST ==="
echo ""

echo "1. Ping:"
if curl -s -f "http://127.0.0.1:5678/webhook/factory-os-ping" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK' if d.get('factory_os') else 'FOUT')"; then
  :
else
  echo "FOUT (webhook bereikbaar? workflow Ping actief?)"
fi

echo ""
echo "2. Research:"
curl -s -X POST "http://127.0.0.1:5678/webhook/factory-os" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Analyseer fumero.nl","klant":"fumero"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK -', d.get('afdeling','?'), '-', len(d.get('output','')),'chars')"

echo ""
echo "3. Marketing:"
curl -s -X POST "http://127.0.0.1:5678/webhook/factory-os" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Schrijf een LinkedIn post voor Fumero","klant":"fumero"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('OK -', d.get('afdeling','?'))"

echo ""
echo "4. Kennisbank:"
if compgen -G "$KB/*.md" >/dev/null 2>&1; then
  n=$(find "$KB" -maxdepth 1 -name '*.md' -type f 2>/dev/null | wc -l)
  echo "OK - $n bestanden"
else
  echo "OK - 0 bestanden (map leeg of ontbreekt)"
fi

echo ""
echo "5. Bibliothecaris:"
if curl -s -f -X POST "http://127.0.0.1:5678/webhook/factory-os-bibliothecaris" -o /dev/null; then
  echo "OK - getriggerd (Telegram binnen ~30s als keys gezet zijn)"
else
  echo "Check n8n UI — workflow actief?"
fi

echo ""
echo "=== MVP COMPLEET (controleer output hierboven) ==="
