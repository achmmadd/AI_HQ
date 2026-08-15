#!/bin/sh
# motor-p2-orchestrator — headless NUC probe. No browser, GUI, Docker or secrets.
#
# Default: disabled / fail-closed.
# Activation on the NUC is a separate owner command. This file is a template.
#
#   MOTOR_P2_ORCHESTRATOR=1 ./motor-p2-orchestrator.sh
#
# Allowed URL only:
#   http://100.97.30.22:4420/motor/orchestrator/health

set -eu

PINNED="http://100.97.30.22:4420/motor/orchestrator/health"
URL="${1:-${MOTOR_P2_ORCHESTRATOR_URL:-$PINNED}}"

if [ "${MOTOR_P2_ORCHESTRATOR:-}" != "1" ]; then
  echo "Disabled. Set MOTOR_P2_ORCHESTRATOR=1 after explicit NUC orchestrator activation." >&2
  exit 2
fi

if [ "$URL" != "$PINNED" ]; then
  echo "Geweigerd: alleen $PINNED is toegestaan." >&2
  exit 2
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "curl ontbreekt." >&2
  exit 1
fi

code="$(curl -sS -m 5 -o /tmp/p2-orch-body -w "%{http_code}" "$PINNED" || true)"
if [ "$code" != "200" ]; then
  echo "Orchestrator-health niet ok (HTTP ${code:-000})." >&2
  exit 1
fi

if grep -Eiq 'context|draft|secret|acl|review|evidence|tenant' /tmp/p2-orch-body; then
  echo "Health-body lekt inhoud. Fail-closed." >&2
  exit 1
fi

echo "P2 orchestrator probe ok. Geen review, publish of externe effecten."
exit 0
