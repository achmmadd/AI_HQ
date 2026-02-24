#!/usr/bin/env bash
# Omega AI-Holding — Verbinding tussen AI-code en 1Panel API
# Run: ./scripts/install_1panel_bridge.sh
# Vereist: 1Panel draait; API-key uit 1Panel → Instellingen → Panel

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

ENV_FILE="$ROOT/.env"
ENV_1PANEL="$ROOT/.env.1panel"

echo "=============================================="
echo "  Omega ↔ 1Panel API-bridge installeren"
echo "=============================================="
echo ""

# 1. Base URL
if [ -n "$ONEPANEL_BASE_URL" ]; then
  BASE_URL="$ONEPANEL_BASE_URL"
  echo "  Gebruik ONEPANEL_BASE_URL: $BASE_URL"
else
  echo "  Voer het 1Panel-adres in (bijv. http://192.168.178.43:1234 of https://panel.jouwdomein.nl)"
  read -r -p "  1Panel URL: " BASE_URL
  BASE_URL="${BASE_URL%/}"
fi
if [ -z "$BASE_URL" ]; then
  echo "  ✗ Geen URL. Stop."
  exit 1
fi
# Waarschuwing: placeholder vervangen door echte URL (bv. IP van je NUC + poort 8089)
if echo "$BASE_URL" | grep -qE "jouw|example|placeholder|8089.*jouw"; then
  echo "  ✗ Fout: je hebt de placeholder gebruikt. Vervang door het echte 1Panel-adres, bijv.:"
  echo "     export ONEPANEL_BASE_URL=\"http://192.168.178.43:8089\""
  echo "     (gebruik het IP van je NUC/host waar 1Panel draait en de juiste poort)"
  exit 1
fi

# 2. API Key (uit 1Panel: Instellingen → Panel → API-sleutel)
if [ -n "$ONEPANEL_API_KEY" ]; then
  API_KEY="$ONEPANEL_API_KEY"
  echo "  Gebruik ONEPANEL_API_KEY (uit omgeving)."
else
  echo "  API-sleutel vind je in 1Panel: Instellingen → Panel → API-sleutel (bekijken/herstellen)."
  read -r -p "  1Panel API Key: " API_KEY
fi
if [ -z "$API_KEY" ]; then
  echo "  ✗ Geen API key. Stop. Haal de key uit 1Panel → Instellingen → Panel → API-sleutel."
  exit 1
fi

# 3. Token genereren en testen (1Panel: md5('1panel' + API_KEY + Timestamp))
TS=$(date +%s)
TOKEN=$(echo -n "1panel${API_KEY}${TS}" | md5sum 2>/dev/null | awk '{print $1}' || echo -n "1panel${API_KEY}${TS}" | md5 2>/dev/null | awk '{print $1}')
RESP=$(curl -sS -o /dev/null -w "%{http_code}" -H "1Panel-Token: ${TOKEN}" -H "1Panel-Timestamp: ${TS}" "${BASE_URL}/api/v1/dashboard/base/os" 2>/dev/null || echo "000")

if [ "$RESP" = "200" ]; then
  echo "  ✓ 1Panel API bereikbaar (HTTP 200)."
else
  echo "  ⚠ 1Panel antwoordde met HTTP $RESP. Controleer URL en API-key. Doorgaan met schrijven config."
  if [ "$RESP" = "403" ]; then
    echo "  Tip 403: Poort 8501 is vaak het Omega-dashboard (Streamlit), niet 1Panel. 1Panel gebruikt meestal 8089 of een andere poort (zie 1Panel → Instellingen → Panel). En: API inschakelen + eventueel IP-allowlist."
  fi
fi

# 4. Schrijf .env.1panel (geen secrets in repo; .env.1panel in .gitignore)
mkdir -p "$ROOT"
cat > "$ENV_1PANEL" << EOF
# 1Panel API — gegenereerd door install_1panel_bridge.sh. Commit dit bestand niet.
ONEPANEL_BASE_URL=$BASE_URL
ONEPANEL_API_KEY=$API_KEY
EOF
echo "  ✓ Geschreven: $ENV_1PANEL"
if ! grep -q "\.env\.1panel" "$ROOT/.gitignore" 2>/dev/null; then
  echo ".env.1panel" >> "$ROOT/.gitignore"
  echo "  ✓ .env.1panel toegevoegd aan .gitignore"
fi

# 5. Source in .env zodat Omega/Jarvis het kan gebruiken (optioneel: alleen als niet al gezet)
if [ -f "$ENV_FILE" ]; then
  if ! grep -q "ONEPANEL_BASE_URL" "$ENV_FILE" 2>/dev/null; then
    echo "" >> "$ENV_FILE"
    echo "# 1Panel (optioneel; of source .env.1panel)" >> "$ENV_FILE"
    echo "# ONEPANEL_BASE_URL=$BASE_URL" >> "$ENV_FILE"
    echo "# ONEPANEL_API_KEY=***" >> "$ENV_FILE"
    echo "  ✓ Aanwijzing in .env toegevoegd. Laad 1Panel-vars met: source .env.1panel"
  fi
fi

# 6. Python-helper voor token-aanvragen (Jarvis / ai_tools kan dit importeren)
HELPER="$ROOT/scripts/onepanel_api.py"
if [ ! -f "$HELPER" ]; then
  echo "  Python-helper onepanel_api.py wordt aangemaakt in scripts/."
fi

echo ""
echo "  Volgende stappen:"
echo "  - Bij start van Omega/Jarvis: source $ENV_1PANEL  (of export ONEPANEL_* in .env)"
echo "  - Test handmatig: python3 scripts/onepanel_api.py status"
echo "  - Log-monitor (1Panel → Telegram): zie scripts/onepanel_log_monitor.sh"
echo ""
