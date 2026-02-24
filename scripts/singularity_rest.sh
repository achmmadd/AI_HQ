#!/usr/bin/env bash
# Omega Singularity — De rest na "API + allowlist gedaan".
# Run: ./scripts/singularity_rest.sh
# Doet: controle .env.1panel, test 1Panel API, toon volgende stap (launch_factory of compose).

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=============================================="
echo "  Omega Singularity — rest na API + allowlist"
echo "=============================================="
echo ""

# 1. .env.1panel
if [ ! -f "$ROOT/.env.1panel" ]; then
  echo "  .env.1panel ontbreekt. Eénmalig bridge installeren met URL + API-key:"
  echo ""
  echo "  export ONEPANEL_BASE_URL=\"http://JOUW_1PANEL_IP:8089\""
  echo "  export ONEPANEL_API_KEY=\"jouw_api_key_uit_1panel\""
  echo "  ./scripts/install_1panel_bridge.sh"
  echo ""
  echo "  Daarna dit script opnieuw runnen."
  exit 0
fi

set -a
# shellcheck source=/dev/null
source "$ROOT/.env.1panel" 2>/dev/null || true
set +a
echo "  ✓ .env.1panel geladen"

# 2. Test 1Panel API
echo ""
echo "  1Panel API testen..."
if python3 "$ROOT/omega_1panel_bridge.py" host 2>/dev/null | grep -q '"ok": true'; then
  echo "  ✓ 1Panel API bereikbaar"
else
  OUT=$(python3 "$ROOT/omega_1panel_bridge.py" host 2>&1) || true
  echo "  ⚠ API-test gaf geen ok: $OUT"
  echo "  Tip: Staat ONEPANEL_BASE_URL op de 1Panel-poort (vaak 8089)? Poort 8501 is het Omega-dashboard."
fi

# 3. Volgende stap
echo ""
echo "  Start Omega (kies één):"
echo "  - Lokaal/NUC:  ./launch_factory.sh"
echo "  - Docker:      docker compose -f docker-compose.singularity.yml up -d"
echo ""
echo "  Daarna: Telegram /panel, dashboard http://localhost:8501"
echo ""
