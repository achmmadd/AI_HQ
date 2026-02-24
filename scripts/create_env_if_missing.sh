#!/usr/bin/env bash
# Maak .env aan als die ontbreekt (bijv. op NUC na clone). Daarna: token zetten met check_telegram_token_env.sh "TOKEN"
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV="$ROOT/.env"
EX="$ROOT/.env.example"

if [ -f "$ENV" ]; then
    echo "  .env bestaat al."
    exit 0
fi

if [ -f "$EX" ]; then
    cp "$EX" "$ENV"
    echo "  .env aangemaakt uit .env.example. Vul TELEGRAM_BOT_TOKEN in (zie hieronder)."
else
    cat > "$ENV" << 'EOF'
# Omega AI-Holding — kopieer naar .env en vul in. Commit .env nooit.
TELEGRAM_BOT_TOKEN=
GOOGLE_API_KEY=
# Optioneel: CANVA_API_KEY=, OPENAI_API_KEY=sk-...
EOF
    echo "  .env aangemaakt (minimaal). Vul TELEGRAM_BOT_TOKEN in (zie hieronder)."
fi

echo ""
echo "  Token zetten:"
echo "    ./scripts/check_telegram_token_env.sh \"JOUW_TOKEN_VAN_BOTFATHER\""
echo "  Of bewerk handmatig: nano ~/AI_HQ/.env"
echo "  Daarna: ./scripts/stop_bridge_and_restart.sh"
exit 0
