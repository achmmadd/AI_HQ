#!/usr/bin/env bash
# Verwijder op de NUC de rommel van de verkeerde rsync (iliass/Mac home → AI_HQ).
# Alleen op de NUC draaien: ssh pietje@openclaw-nuc 'cd ~/AI_HQ && ./scripts/opruimen_verkeerde_sync.sh'
# Of na SSH: cd ~/AI_HQ && ./scripts/opruimen_verkeerde_sync.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Opruimen van verkeerde sync (iliass/Mac home-rommel) in $ROOT ..."

# Eerste ronde
[ -d "$ROOT/Library" ] && rm -rf "$ROOT/Library" && echo "  Verwijderd: Library/"
[ -d "$ROOT/.zsh_sessions" ] && rm -rf "$ROOT/.zsh_sessions" && echo "  Verwijderd: .zsh_sessions/"
[ -d "$ROOT/.cursor" ] && rm -rf "$ROOT/.cursor" && echo "  Verwijderd: .cursor/"
[ -f "$ROOT/.zsh_history" ] && rm -f "$ROOT/.zsh_history" && echo "  Verwijderd: .zsh_history"
# Extra Mac/home-rommel
for name in .adobe .android Applications .cups Desktop Documents Downloads .DS_Store .CFUserTextEncoding; do
  [ -e "$ROOT/$name" ] && rm -rf "$ROOT/$name" && echo "  Verwijderd: $name"
done
[ -f "$ROOT/enable telegram" ] && rm -f "$ROOT/enable telegram" && echo "  Verwijderd: enable telegram"
for dir in "$ROOT"/Creative\ Cloud\ Files*; do
  [ -d "$dir" ] && rm -rf "$dir" && echo "  Verwijderd: $(basename "$dir")"
done
[ -d "$ROOT/backups" ] && [ ! -f "$ROOT/backups/.keep" ] && rm -rf "$ROOT/backups" && echo "  Verwijderd: backups/" || true

echo "Klaar. Alleen AI_HQ-projectbestanden blijven over."
ls -la "$ROOT" | head -30
