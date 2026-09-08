# Opdracht aan QwenPaw — geen Motor-token, credential-loze helper

> **Van:** Pietje
> **Gebruik:** plak in de bestaande `boka_operations`-chat.

---

Pietje hier. Je bent in dienst. OFFLINE is goed. `agent.json` niet aanraken blijft goed.

**Correctie:** zet **geen** `MOTOR_API_TOKEN` en verzin **geen** `MOTOR_API_URL`. Een Motor-sessietoken in jouw omgeving is verboden. De Motor Next-API eist auth; die route gebruiken we niet.

Vervang jouw helper door de credential-loze versie hieronder. Die praat alleen met de bookkeeping-bot (`/health`, `/recent`, `/export/documents`): `BOOKKEEPING_BOT_URL` als Pietje die gezet heeft, anders probeert het `127.0.0.1:8001`, `host.docker.internal:8001`, `172.17.0.1:8001`. Geen Authorization-header.

## Doe nu

1. Overschrijf alleen deze twee skill-bestanden (BEGIN/END-regels niet meeschrijven). Persona mag blijven.
2. Verwijder `MOTOR_API_TOKEN` en `MOTOR_API_URL` uit jouw env/skill-config als je die hebt aangemaakt. Print ze niet.
3. Run:

```
python3 /app/working/workspaces/boka_operations/skills/project-administratie/scripts/motor_admin.py probe
```

OFFLINE blijft geldig. Geen URL verzinnen.

4. Telegram: jij zet het kanaal **niet** via `agent.json`. Pietje doet dat in de Console (token + allowlist). Jij meldt alleen of het kanaal al enabled is, zonder token te tonen.

5. Administratie-vragen: script draaien, deeplink geven. Approven/boeken = weigeren + `https://motorsai.app/cowork?tab=approvals`.

## Bestanden

### `/app/working/workspaces/boka_operations/skills/project-administratie/SKILL.md`

===== BEGIN FILE: /app/working/workspaces/boka_operations/skills/project-administratie/SKILL.md =====
---
name: project-administratie
description: Read-only inzage in de Motor-projectadministratie (openstaande bonnen, recente boekingen, kwartaalexport, aantal approvals) met deeplinks naar de Motor UI voor alle acties.
---

# Projectadministratie (Motor)

Gebruik deze skill als de eigenaar vraagt naar de administratie van de projecten
(fumero/bokas): openstaande bonnen, recente boekingen, de kwartaalexport voor de
boekhouder, of hoeveel items nog goedkeuring wachten.

## Uitvoering

Draai het meegeleverde helper-script. Het is read-only, draait op loopback en
heeft geen credentials nodig:

```bash
python3 scripts/motor_admin.py probe
python3 scripts/motor_admin.py status
python3 scripts/motor_admin.py recent
python3 scripts/motor_admin.py documents --year 2026 --quarter 3
```

Het script staat in de `scripts/`-map van deze skill, bijvoorbeeld
`/app/working/workspaces/boka_operations/skills/project-administratie/scripts/motor_admin.py`.
Kies `--year`/`--quarter` op basis van de vraag; bij twijfel het huidige kwartaal.

- `status` — gezondheid van de administratie-service: `pending_approvals`,
  `retry_queue`, vrije schijfruimte, plus de deeplink naar de approvals-inbox.
- `recent` — recent geboekte bonnen (datum, leverancier, bedrag voor zover
  beschikbaar).
- `documents` — exportdocumenten van een kwartaal voor de boekhouder.

## Regels (bindend)

- Antwoord in het Nederlands en compact. Sluit elk antwoord af met de
  deeplink(s) die het script print, zodat de eigenaar acties in de Motor UI
  uitvoert.
- Voer NOOIT schrijfacties uit: geen boekingen, approvals, edits, exports of
  uploads. Bij een actieverzoek ("boek deze bon", "keur dit goed") antwoord je
  vriendelijk dat dat in de Motor UI moet, met de bijbehorende deeplink.
- Print het script `OFFLINE` (exitcode 2), meld dan welke URL's zijn
  geprobeerd en dat `BOOKKEEPING_BOT_URL` **onbekend, meten door Pietje**
  is. Raad nooit een herstart aan zonder expliciete vraag van de eigenaar.
- Deel administratie-inhoud alleen in de privéchat met de eigenaar. In
  groepschats: geen bedragen, leveranciers of documentnamen — alleen verwijzen
  naar de Motor UI.
- Sla geen administratie-data op in geheugen of bestanden; elke vraag haalt
  verse data via het script.
- Geen `MOTOR_API_TOKEN`, geen Motor-sessiecookie, geen Authorization-header.
  Geen `MOTOR_API_URL` naar de Motor Next-app. Alleen de bookkeeping-bot
  (credential-loos) of OFFLINE.
===== END FILE =====

### `/app/working/workspaces/boka_operations/skills/project-administratie/scripts/motor_admin.py`

===== BEGIN FILE: /app/working/workspaces/boka_operations/skills/project-administratie/scripts/motor_admin.py =====
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

UI_BASE = os.environ.get("MOTOR_UI_BASE", "https://motorsai.app").rstrip("/")
TIMEOUT = 8

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
    print(f"Approvals afhandelen in Motor UI: {UI_BASE}/cowork?tab=approvals")


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
===== END FILE =====
