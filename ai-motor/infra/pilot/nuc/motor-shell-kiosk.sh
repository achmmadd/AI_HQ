#!/bin/sh
# motor-shell-kiosk — P1.7 voorbereiding, GEEN activatie.
#
# Opent uitsluitend een tailnet-URL naar de synthetische /motor-shell.
# Deploy, NUC-start en live-authority blijven een aparte eigenaarshandeling.
#
# Gebruik (placeholder — echte origin komt uit de operator-omgeving):
#   MOTOR_SHELL_URL="http://<HETZNER_TAILNET_IP>:3000/motor" ./motor-shell-kiosk.sh
#
# Verboden: reverse proxy, lokale business-state, CORS-wildcard, model/store-poort.

set -eu

URL="${1:-${MOTOR_SHELL_URL:-}}"

if [ -z "$URL" ]; then
  echo "Geen MOTOR_SHELL_URL gezet." >&2
  echo "Voorbeeld: MOTOR_SHELL_URL=\"http://<HETZNER_TAILNET_IP>:3000/motor\" $0" >&2
  exit 2
fi

case "$URL" in
  http://*|https://*) ;;
  *)
    echo "URL moet met http:// of https:// beginnen (tailnet-origin)." >&2
    exit 2
    ;;
esac

case "$URL" in
  */motor|*/motor/) ;;
  *)
    echo "URL moet het /motor-pad gebruiken. Geen andere productroutes." >&2
    exit 2
    ;;
esac

echo "P1.7 kiosk-prep: URL-vorm ok. Activeer of deploy dit script niet zonder eigenaarsopdracht."
echo "Doelpad: /motor (synthetische shell). Publish blijft DENY."
exit 0
