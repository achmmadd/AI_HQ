#!/usr/bin/env bash
# Wrapper voor systemd: start launch_factory.sh en exit altijd 0 (zodat de service niet faalt).
# Gebruikt door omega-holding.service.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
./launch_factory.sh || true
exit 0
