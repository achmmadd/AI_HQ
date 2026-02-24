#!/usr/bin/env bash
# Omega — Nieuwe Business Unit installeren (1Panel App Store-logica).
# Run: ./scripts/deploy_bu.sh <bu_name>   bv. marketing

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BU_NAME="${1:-}"
if [ -z "$BU_NAME" ]; then
  echo "  Gebruik: $0 <bu_name>   (marketing, app_studio, copy_center, finance)"
  exit 1
fi

for allowed in marketing app_studio copy_center finance; do
  if [ "$BU_NAME" = "$allowed" ]; then
    BU_DIR="$ROOT/holding/$BU_NAME"
    BU_DATA="$BU_DIR/data"
    mkdir -p "$BU_DIR" "$BU_DATA"
    echo "  OK $BU_DIR en $BU_DATA"

    # profile.json voor 1Panel / Jarvis (BU-metadata)
    PROFILE="$BU_DIR/profile.json"
    if [ ! -f "$PROFILE" ]; then
      cat > "$PROFILE" << EOF
{
  "bu_name": "$BU_NAME",
  "display_name": "$BU_NAME",
  "created": "$(date -Iseconds)",
  "container_name": "bu_$BU_NAME",
  "status": "active"
}
EOF
      echo "  OK $PROFILE aangemaakt"
    fi

    [ -f "$BU_DIR/README.md" ] || echo "# BU: $BU_NAME" > "$BU_DIR/README.md"
    echo "  BU $BU_NAME klaar."
    echo "  Tip: In 1Panel kun je een container voor deze BU toevoegen (Compose of App Store). Container-naam: bu_$BU_NAME"
    exit 0
  fi
done
echo "  Ongeldige BU: $BU_NAME"
exit 1
