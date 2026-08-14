#!/bin/sh
# motor-pilot-kiosk — minimale NUC-testconsole launcher.
#
# Topologie (P0, bewust zo gehouden):
# - De NUC is UITSLUITEND een tailnet-browser/kiosk naar de Hetzner-pilot-UI.
# - De browser praat direct met de Hetzner tailnet-origin, zodat WhoIs de
#   echte clientnode (de NUC) ziet — geen reverse proxy, geen identiteits-
#   vervalsing.
# - De NUC bewaart geen context, drafts of secrets en praat nooit direct
#   met de model- of storepoort.
#
# Dit script bevat alleen placeholders. De echte URL komt uit de omgeving
# (MOTOR_PILOT_URL) of het eerste argument — nooit uit de repo.
#
# Gebruik:
#   MOTOR_PILOT_URL="http://<HETZNER_TAILNET_IP>:4400/" ./motor-pilot-kiosk.sh
#   ./motor-pilot-kiosk.sh "http://<HETZNER_TAILNET_IP>:4400/"

set -eu

URL="${1:-${MOTOR_PILOT_URL:-}}"

if [ -z "$URL" ]; then
  echo "Geen MOTOR_PILOT_URL gezet." >&2
  echo "Voorbeeld: MOTOR_PILOT_URL=\"http://<HETZNER_TAILNET_IP>:4400/\" $0" >&2
  exit 2
fi

case "$URL" in
  http://*|https://*) ;;
  *)
    echo "URL moet met http:// of https:// beginnen (tailnet-origin)." >&2
    exit 2
    ;;
esac

# Kiosk-modus: geen adresbalk, geen tabs, eigen tijdelijk profiel zodat er
# geen persoonlijke browserdata op de NUC blijft hangen.
PROFILE_DIR="$(mktemp -d /tmp/motor-pilot-kiosk.XXXXXX)"
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

echo "NUC-kiosk start naar $URL (browser: $BROWSER)"
echo "Publish/write blijft DENY — deze console is alleen voor lezen en toezicht."

if [ "$BROWSER" = "firefox" ]; then
  exec "$BROWSER" --kiosk --profile "$PROFILE_DIR" "$URL"
else
  exec "$BROWSER" \
    --kiosk \
    --user-data-dir="$PROFILE_DIR" \
    --no-first-run \
    --disable-session-crashed-bubble \
    "$URL"
fi
