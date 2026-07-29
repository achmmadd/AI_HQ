#!/usr/bin/env python3
"""
Zoek je NUC in het Tailscale-netwerk en print een ~/.ssh/config-blok voor Cursor Remote-SSH.

Run op je laptop (niet op de agent-VM): daar moet `tailscale` geïnstalleerd zijn.

  python3 scripts/tailscale_ssh_snippet.py
  python3 scripts/tailscale_ssh_snippet.py openclaw

Omgevingsvariabelen (optioneel):
  SSH_NUC_USER   — SSH-gebruiker op de NUC (default: pietje)
  SSH_NUC_ALIAS  — Host-alias in config (default: nuc-tailscale)
"""

from __future__ import annotations

import json
import os
import subprocess
import sys


def main() -> None:
    args = sys.argv[1:]
    append = "--append" in args
    argv = [a for a in args if a != "--append"]
    needle = argv[0].lower() if argv else ""

    try:
        raw = subprocess.check_output(["tailscale", "status", "--json"], text=True)
    except FileNotFoundError:
        print(
            "tailscale CLI niet gevonden. Installeer Tailscale op deze machine en "
            "probeer opnieuw.",
            file=sys.stderr,
        )
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(e.stderr or e, file=sys.stderr)
        sys.exit(1)

    data = json.loads(raw)
    peers: dict = data.get("Peer") or {}
    user = os.environ.get("SSH_NUC_USER", "pietje")
    host_alias = os.environ.get("SSH_NUC_ALIAS", "nuc-tailscale")

    if not needle:
        print("Peers in je tailnet (zoek de NUC aan hostname of DNS-naam):\n")
        for _pid, p in peers.items():
            dns = (p.get("DNSName") or "").rstrip(".")
            hn = p.get("HostName") or ""
            ips = p.get("TailscaleIPs") or []
            ip4 = next((ip for ip in ips if "." in ip), ips[0] if ips else "?")
            label = hn or dns or "?"
            print(f"  {ip4:16}  {label}")
        print()
        print("Gebruik: python3 scripts/tailscale_ssh_snippet.py <deel-van-hostname>")
        print("Voorbeeld: python3 scripts/tailscale_ssh_snippet.py openclaw")
        sys.exit(0)

    match = None
    for _pid, p in peers.items():
        hn = (p.get("HostName") or "").lower()
        dns = (p.get("DNSName") or "").lower()
        if needle in hn or needle in dns:
            match = p
            break

    if not match:
        print(f"Geen peer gevonden waar '{argv[0]}' in hostname/DNS voorkomt.", file=sys.stderr)
        sys.exit(1)

    ips = match.get("TailscaleIPs") or []
    ip4 = next((ip for ip in ips if "." in ip), None)
    if not ip4:
        print("Geen IPv4-adres voor deze peer.", file=sys.stderr)
        sys.exit(1)

    block = (
        f"# Cursor / ssh: Remote-SSH host '{host_alias}' (Tailscale)\n"
        f"Host {host_alias}\n"
        f"  HostName {ip4}\n"
        f"  User {user}\n"
    )

    ssh_config = os.path.expanduser("~/.ssh/config")

    print(block)
    if append:
        os.makedirs(os.path.dirname(ssh_config), mode=0o700, exist_ok=True)
        with open(ssh_config, "a", encoding="utf-8") as f:
            f.write("\n")
            f.write(block)
        print(f"Toegevoegd aan {ssh_config}", file=sys.stderr)
    else:
        print(
            f"Plak het blok hierboven in {ssh_config} "
            f"(of: herhaal met --append om automatisch toe te voegen).",
            file=sys.stderr,
        )
    print(
        "Open daarna Cursor → Command Palette → Remote-SSH: Connect to Host → "
        f"{host_alias}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
