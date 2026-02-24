#!/usr/bin/env bash
# Sync AI_HQ naar de NUC. Run op de machine waar deze map staat (bijv. je Mac/Cursor).
# Gebruik: ./scripts/sync_naar_nuc.sh
# Of:     ./scripts/sync_naar_nuc.sh 192.168.178.44   (ander IP)
# Je wordt één keer om je SSH-wachtwoord gevraagd.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
NUC_IP="${1:-192.168.178.43}"
USER="${2:-pietje}"

# Op de NUC draaien? Sync is bedoeld: laptop → NUC. Overrule met --force.
if [ "$1" != "--force" ] && [ "$1" != "-f" ]; then
  if [ "$(hostname 2>/dev/null)" = "openclaw-nuc" ] || [ "$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -m1 .)" = "$NUC_IP" ]; then
    echo "⚠ Je draait dit op de NUC. Sync is bedoeld om vanaf je LAPTOP te draaien (laptop → NUC)."
    echo "  Op de laptop: cd ~/AI_HQ && ./scripts/sync_naar_nuc.sh"
    echo "  Om toch te syncen: ./scripts/sync_naar_nuc.sh --force"
    exit 0
  fi
fi
# --force kan als eerste arg staan; NUC_IP kan als $1 of $2
[ "$1" = "--force" ] || [ "$1" = "-f" ] && shift
NUC_IP="${1:-192.168.178.43}"
USER="${2:-pietje}"

echo "Sync $ROOT naar ${USER}@${NUC_IP}:~/AI_HQ/"
echo "(Wachtwoord voor ${USER}@${NUC_IP} kan gevraagd worden.)"
echo ""

rsync -avz --exclude venv --exclude __pycache__ --exclude .git \
  -e "ssh -o StrictHostKeyChecking=accept-new" \
  "$ROOT/" "${USER}@${NUC_IP}:~/AI_HQ/"

echo ""
echo "Klaar. Op de NUC:"
echo "  ssh ${USER}@${NUC_IP}"
echo "  cd ~/AI_HQ && chmod +x launch_factory.sh scripts/*.sh"
echo "  ./scripts/create_env_if_missing.sh   # als .env nog niet bestaat"
echo "  nano .env   # TELEGRAM_BOT_TOKEN invullen"
echo "  ./launch_factory.sh"
echo ""
