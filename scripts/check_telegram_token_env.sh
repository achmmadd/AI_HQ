#!/usr/bin/env bash
# Controleer of TELEGRAM_BOT_TOKEN in .env een echte token is (geen placeholder).
# Token zetten: ./scripts/check_telegram_token_env.sh "JOUW_TOKEN"   of   ./scripts/check_telegram_token_env.sh -i
set -e
cd "$(dirname "$0")/.."
ENV="$PWD/.env"
PLACEHOLDER="123456789:AAFxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

set_token() {
  local new_token="$1"
  [ -z "$new_token" ] && echo "FOUT: Geen token opgegeven." && return 1
  if [ ! -f "$ENV" ]; then
    echo "TELEGRAM_BOT_TOKEN=$new_token" > "$ENV"
    echo "  .env aangemaakt met TELEGRAM_BOT_TOKEN."
  else
    local tmp; tmp=$(mktemp)
    if grep -q "^TELEGRAM_BOT_TOKEN=" "$ENV" 2>/dev/null; then
      sed "s|^TELEGRAM_BOT_TOKEN=.*|TELEGRAM_BOT_TOKEN=$new_token|" "$ENV" > "$tmp"
    else
      cp "$ENV" "$tmp"
      echo "TELEGRAM_BOT_TOKEN=$new_token" >> "$tmp"
    fi
    mv "$tmp" "$ENV"
    echo "  TELEGRAM_BOT_TOKEN in .env bijgewerkt."
  fi
}

if [ -n "$1" ]; then
  if [ "$1" = "-i" ] || [ "$1" = "--interactive" ]; then
    echo "Plak je Omega-bot token (invoer verborgen):"
    read -rs TOKEN; echo ""
    [ -n "$TOKEN" ] && set_token "$TOKEN"
  else
    set_token "$1"
  fi
  echo ""
fi

[ ! -f "$ENV" ] && echo "FOUT: .env niet gevonden. Run: ./scripts/create_env_if_missing.sh" && exit 1
VAL=$(grep -m1 "^TELEGRAM_BOT_TOKEN=" "$ENV" 2>/dev/null | sed 's/^TELEGRAM_BOT_TOKEN=//' | tr -d '"' | tr -d "'" | tr -d '\r')
LEN=${#VAL}
[ -z "$VAL" ] && echo "FOUT: TELEGRAM_BOT_TOKEN is leeg." && echo "  Token: $0 \"JOUW_TOKEN\" of $0 -i" && exit 1
[ "$VAL" = "$PLACEHOLDER" ] || echo "$VAL" | grep -q "xxx" && echo "FOUT: Nog de placeholder (lengte $LEN). Vervang in .env of: $0 \"TOKEN\"" && exit 1
echo "OK: TELEGRAM_BOT_TOKEN ziet er goed uit (lengte $LEN)."
exit 0
