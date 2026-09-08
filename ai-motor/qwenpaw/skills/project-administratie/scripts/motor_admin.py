#!/usr/bin/env python3
"""Read-only helper voor de Motor-projectadministratie (bookkeeping-bot).

Spiegelt de read-only GET-paden die de Motor-app zelf gebruikt
(ai-motor/app/api/bookkeeping/*). Doet bewust geen enkele schrijfactie:
approvals, boekingen en exports blijven in de Motor UI (ADR-109/110).

Exitcode 0 = gelukt, 2 = service offline of ongeldig antwoord.
"""

import argparse
import json
import os
import sys
import urllib.error
import urllib.request

BOT_BASE = os.environ.get("BOOKKEEPING_BOT_URL", "http://127.0.0.1:8001").rstrip("/")
UI_BASE = os.environ.get("MOTOR_UI_BASE", "https://motorsai.app").rstrip("/")
TIMEOUT = 8


def get_json(path: str):
    url = f"{BOT_BASE}{path}"
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


def cmd_status() -> None:
    data = get_json("/health")
    status = data.get("status", "onbekend")
    pending = data.get("pending_approvals", 0)
    retry = data.get("retry_queue", 0)
    disk = data.get("disk_free_mb")
    print(f"Administratie-service: {status}")
    print(f"Open approvals: {pending}")
    print(f"Retry-queue: {retry}")
    if isinstance(disk, (int, float)):
        print(f"Schijf vrij: {disk} MB")
    print(f"Approvals afhandelen in Motor UI: {UI_BASE}/cowork?tab=approvals")


def cmd_recent() -> None:
    data = get_json("/recent")
    receipts = data.get("receipts") if isinstance(data, dict) else data
    if not isinstance(receipts, list) or not receipts:
        print("Geen recente bonnen gevonden.")
        print(f"Administratie openen: {UI_BASE}/cowork")
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
    print(f"Details/bewerken in Motor UI: {UI_BASE}/cowork")


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
    print(f"Export beheren in Motor UI: {UI_BASE}/cowork")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Read-only Motor-projectadministratie via de bookkeeping-bot."
    )
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("status", help="Gezondheid + open approvals/retry-queue")
    sub.add_parser("recent", help="Recent geboekte bonnen")
    docs = sub.add_parser("documents", help="Exportdocumenten per kwartaal")
    docs.add_argument("--year", required=True)
    docs.add_argument("--quarter", required=True, choices=["1", "2", "3", "4"])
    args = parser.parse_args()

    if args.command == "status":
        cmd_status()
    elif args.command == "recent":
        cmd_recent()
    else:
        cmd_documents(args.year, args.quarter)


if __name__ == "__main__":
    main()
