#!/bin/bash
# Start Omega op de NUC: venv activeren, seed (eenmalig), telegram bridge.
# Gebruik: cd ~/AI_HQ && bash scripts/start_on_nuc.sh

set -e
cd "$(dirname "$0")/.."

if [ ! -d "venv" ]; then
  echo "Geen venv gevonden. Eerst: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

source venv/bin/activate

# Holding seed (idempotent)
python3 -c "
from holding.src.agent_registry import seed_tenants_and_agents
r = seed_tenants_and_agents()
print('Seed:', r)
"

echo "Start telegram_bridge.py in de achtergrond..."
nohup python3 telegram_bridge.py >> logs/telegram_bridge.log 2>&1 &
echo "PID: $!"
echo "Log: tail -f logs/telegram_bridge.log"
