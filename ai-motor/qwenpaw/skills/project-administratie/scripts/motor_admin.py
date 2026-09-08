#!/usr/bin/env python3
"""Read-only helper voor de Motor-projectadministratie (bookkeeping-bot).

Spiegelt de read-only GET-paden die de Motor-app zelf gebruikt
(ai-motor/app/api/bookkeeping/*). Doet bewust geen enkele schrijfactie:
approvals, boekingen en exports blijven in de Motor UI (ADR-109/110).

Zonder BOOKKEEPING_BOT_URL probeert het script loopback en daarna de
gebruikelijke Docker-host-adressen. Geen Motor-sessietoken, geen writes.

Exitcode 0 = gelukt, 2 = service offline of ongeldig antwoord.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

TIMEOUT = 8
INFO_FOOTER = (
    "Dit antwoord IS de administratie-info. "
    "Geen /cowork-link — die Motor-pagina bestaat niet meer. "
    "Schrijven (boeken/approven) doe je niet in QwenPaw."
)

_resolved_base = None


def candidate_bases():
    env = os.environ.get("BOOKKEEPING_BOT_URL", "").strip()
    if env:
        return [env.rstrip("/")]
    return [
        "http://127.0.0.1:8001",
        "http://host.docker.internal:8001",
        "http://172.17.0.1:8001",
    ]


def fetch_health(base: str):
    url = f"{base.rstrip('/')}/health"
    with urllib.request.urlopen(url, timeout=TIMEOUT) as res:
        return json.loads(res.read().decode("utf-8"))


def resolve_base():
    global _resolved_base
    if _resolved_base:
        return _resolved_base
    errors = []
    for base in candidate_bases():
        try:
            fetch_health(base)
            _resolved_base = base
            return base
        except (urllib.error.URLError, OSError, ValueError) as exc:
            errors.append(f"{base}: {exc}")
    print("OFFLINE: administratie-service niet bereikbaar.")
    print("Geprobeerd:")
    for line in errors:
        print(f"- {line}")
    print("Zet BOOKKEEPING_BOT_URL als de bot elders luistert. Geen credentials nodig.")
    sys.exit(2)


def get_json(path: str):
    url = f"{resolve_base()}{path}"
    try:
        with urllib.request.urlopen(url, timeout=TIMEOUT) as res:
            return json.loads(res.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, ValueError) as exc:
        print(f"OFFLINE: administratie-service niet bereikbaar op {url} ({exc})")
        sys.exit(2)


def pick(item: dict, *keys: str) -> str:
    for key in keys:
        value = item.get(key)
        if value not in (None, ""):
            return str(value)
    return ""


def cmd_probe() -> None:
    any_ok = False
    print("Read-only probe (geen secrets):")
    for base in candidate_bases():
        try:
            data = fetch_health(base)
            status = data.get("status", "onbekend")
            pending = data.get("pending_approvals", "?")
            print(f"- {base} → bereikbaar, status={status}, pending_approvals={pending}")
            any_ok = True
        except (urllib.error.URLError, OSError, ValueError) as exc:
            print(f"- {base} → niet bereikbaar ({exc})")
    if not any_ok:
        print("Geen kandidaat bereikbaar. BOOKKEEPING_BOT_URL is onbekend, meten door Pietje.")
        sys.exit(2)
    print(INFO_FOOTER)


def cmd_status() -> None:
    base = resolve_base()
    data = get_json("/health")
    status = data.get("status", "onbekend")
    pending = data.get("pending_approvals", 0)
    retry = data.get("retry_queue", 0)
    disk = data.get("disk_free_mb")
    print(f"Administratie-bron: {base}")
    print(f"Administratie-service: {status}")
    print(f"Open approvals: {pending}")
    print(f"Retry-queue: {retry}")
    if isinstance(disk, (int, float)):
        print(f"Schijf vrij: {disk} MB")
    print(INFO_FOOTER)


def cmd_recent() -> None:
    data = get_json("/recent")
    receipts = data.get("receipts") if isinstance(data, dict) else data
    if not isinstance(receipts, list) or not receipts:
        print("Geen recente bonnen gevonden.")
        print(INFO_FOOTER)
        return
    print(f"Recente bonnen ({len(receipts)}):")
    for receipt in receipts[:15]:
        if not isinstance(receipt, dict):
            print(f"- {json.dumps(receipt, ensure_ascii=False)[:160]}")
            continue
        datum = pick(receipt, "date", "datum", "boekingsdatum", "created_at")
        wie = pick(receipt, "vendor", "leverancier", "naam", "merchant")
        bedrag = pick(receipt, "amount", "bedrag", "totaal", "total")
        status = pick(receipt, "status")
        delen = [deel for deel in (datum, wie, bedrag, status) if deel]
        print(f"- {' | '.join(delen) if delen else json.dumps(receipt, ensure_ascii=False)[:160]}")
    print(INFO_FOOTER)


def cmd_documents(year: str, quarter: str) -> None:
    data = get_json(f"/export/documents?year={year}&quarter={quarter}")
    items = data.get("items") if isinstance(data, dict) else data
    if not isinstance(items, list) or not items:
        print(f"Geen exportdocumenten voor {year} Q{quarter}.")
    else:
        print(f"Exportdocumenten {year} Q{quarter} ({len(items)}):")
        for item in items[:25]:
            if isinstance(item, dict):
                naam = pick(item, "name", "filename", "path", "bestand")
                print(f"- {naam or json.dumps(item, ensure_ascii=False)[:160]}")
            else:
                print(f"- {item}")
    print(INFO_FOOTER)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Read-only Motor-projectadministratie via de bookkeeping-bot."
    )
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("probe", help="Welke bookkeeping-URL bereikbaar is (loopback/Docker-host)")
    sub.add_parser("status", help="Gezondheid + open approvals/retry-queue")
    sub.add_parser("recent", help="Recent geboekte bonnen")
    docs = sub.add_parser("documents", help="Exportdocumenten per kwartaal")
    docs.add_argument("--year", required=True)
    docs.add_argument("--quarter", required=True, choices=["1", "2", "3", "4"])
    args = parser.parse_args()

    if args.command == "probe":
        cmd_probe()
    elif args.command == "status":
        cmd_status()
    elif args.command == "recent":
        cmd_recent()
    else:
        cmd_documents(args.year, args.quarter)


if __name__ == "__main__":
    main()
