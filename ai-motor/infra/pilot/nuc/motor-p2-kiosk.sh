#!/bin/sh
# motor-p2-kiosk — NUC-browser naar exact één gepinde tailnet-origin.
#
# Geen secrets. Geen reverse proxy. Geen lokale backend.
# Start de browser niet zonder bereikbare, gepinde origin.
# Live start op de NUC vereist het letterlijke commando ACTIVATE P2.0.

set -eu

PINNED_ORIGIN="http://100.97.30.22:4420/motor"
PINNED_HEALTH="http://100.97.30.22:4420/motor/health"
URL="${1:-${MOTOR_P2_URL:-$PINNED_ORIGIN}}"

normalize() {
  printf '%s' "$1" | sed 's|/*$||'
}

if [ "$(normalize "$URL")" != "$(normalize "$PINNED_ORIGIN")" ]; then
  echo "Geweigerd: origin is niet de gepinde P2.0-origin." >&2
  echo "Toegestaan: $PINNED_ORIGIN" >&2
  exit 2
fi

case "$URL" in
  http://100.97.30.22:4420/motor|http://100.97.30.22:4420/motor/) ;;
  *)
    echo "Geweigerd: verkeerde route of host." >&2
    exit 2
    ;;
esac

probe() {
  if command -v wget >/dev/null 2>&1; then
    wget -q -O /dev/null --timeout=5 "$PINNED_HEALTH"
  elif command -v curl >/dev/null 2>&1; then
    curl -sS -m 5 -o /dev/null "$PINNED_HEALTH"
  else
    echo "Geen wget of curl om de gepinde origin te toetsen." >&2
    exit 1
  fi
}

if ! probe; then
  echo "Gepinde origin is niet bereikbaar: $PINNED_HEALTH" >&2
  echo "Start de kiosk niet. Geen fallback-origin." >&2
  exit 1
fi

if [ "${MOTOR_P2_DRY_RUN:-}" = "1" ]; then
  echo "P2.0 kiosk dry-run: origin bereikbaar. Browser niet gestart."
  exit 0
fi

PROFILE_DIR="$(mktemp -d /tmp/motor-p2-kiosk.XXXXXX)"
trap 'rm -rf "$PROFILE_DIR"' EXIT INT TERM

if command -v chromium-browser >/dev/null 2>&1; then
  BROWSER=chromium-browser
elif command -v chromium >/dev/null 2>&1; then
  BROWSER=chromium
elif command -v google-chrome >/dev/null 2>&1; then
  BROWSER=google-chrome
elif command -v firefox >/dev/null 2>&1; then
  BROWSER=firefox
else
  echo "Geen ondersteunde browser gevonden (chromium/chrome/firefox)." >&2
  exit 1
fi

echo "NUC-kiosk start naar $PINNED_ORIGIN (browser: $BROWSER)"
echo "Publish blijft DENY. ACTIVATE P2.0 is de enige live-start."

if [ "$BROWSER" = "firefox" ]; then
  exec "$BROWSER" --kiosk --profile "$PROFILE_DIR" "$PINNED_ORIGIN"
else
  exec "$BROWSER" \
    --kiosk \
    --user-data-dir="$PROFILE_DIR" \
    --no-first-run \
    --disable-session-crashed-bubble \
    "$PINNED_ORIGIN"
fi
