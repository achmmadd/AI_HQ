#!/usr/bin/env bash
# rtx-gpu-setup.sh — eenmalige GPU-setup voor de inference-PC (RTX 3090).
#
# Doel: NVIDIA-driver + CUDA-toolkit installeren zodat llama-server met CUDA kan draaien.
# Dit is de enige systeemwijziging van de motor-pilot op deze host. De pilot draait
# verder volledig in userspace (geen docker, geen extra services).
#
# Uitvoering: door de operator ZELF, op de RTX-pc (of via ssh -t), met sudo:
#   sudo bash rtx-gpu-setup.sh            # installeert; herstart NIET automatisch
#   sudo bash rtx-gpu-setup.sh --reboot   # installeert en herstart direct
#
# Na de reboot verifiëren (geen sudo nodig):
#   nvidia-smi        # verwacht: RTX 3090, 24576 MiB
#
# Voorwaarden: Ubuntu 24.04, RTX 3090 aanwezig, ~6 GB vrije schijfruimte op /,
# en een moment waarop de machine mag rebooten (hij staat op het LAN, fysiek bereikbaar).

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Draai dit script met sudo:  sudo bash $0 [--reboot]" >&2
  exit 1
fi

echo "== motor-pilot GPU-setup — inference-PC (stap 2 van de pilot) =="
echo "   $(date -u +%Y-%m-%dT%H:%M:%SZ) op $(hostname)"

echo "── Precondities ──"
. /etc/os-release
echo "OS: ${NAME} ${VERSION}"
lspci -nn | grep -iE 'vga|3d controller' || { echo "✗ Geen GPU gevonden — stop."; exit 1; }
if lsmod | grep -q '^nvidia'; then
  echo "✓ NVIDIA-driver is al geladen — niets te doen. Verifieer met: nvidia-smi"
  exit 0
fi
lsmod | grep -q '^nouveau' && echo "  nouveau actief (verwacht); wordt vervangen door de NVIDIA-driver"
df -h / | tail -1

echo "── Installatie: NVIDIA-driver (ubuntu-drivers) + CUDA-toolkit + buildtools ──"
export DEBIAN_FRONTEND=noninteractive
apt-get update
ubuntu-drivers install
apt-get install -y nvidia-cuda-toolkit build-essential cmake libcurl4-openssl-dev

echo ""
echo "== Installatie klaar. De GPU werkt pas na een herstart. =="
if [[ "${1:-}" == "--reboot" ]]; then
  echo "Herstart over 5 seconden... (Ctrl+C om af te breken)"
  sleep 5
  reboot
else
  echo "Herstart nu zelf met:   sudo reboot"
  echo "Verifieer daarna met:   nvidia-smi   (verwacht: RTX 3090, 24576 MiB, driverversie zichtbaar)"
fi
