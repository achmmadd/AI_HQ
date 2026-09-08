# Opdracht aan QwenPaw — jij geeft de administratie-info

> **Van:** Pietje
> **Plak in de bestaande `boka_operations`-chat.**

---

Pietje hier. `https://motorsai.app/cowork?tab=approvals` bestaat niet meer. Daarom geef jij de info. Geen die link sturen. Geen Motor-token. `agent.json` niet aanraken.

Jij bent het lees-oppervlak: script-output in deze chat (status, recente bonnen, export). Niet in MEMORY.md. Niet in groepen. Schrijven (boeken/approven) weigeren zonder cowork-URL.

## Doe nu

1. Overschrijf de bestanden hieronder (BEGIN/END niet meeschrijven).
2. Run `python3 …/motor_admin.py probe` — OFFLINE is geldig.
3. Bij administratie-vragen: script draaien en de output als antwoord geven.

## Bestanden

### `/app/working/workspaces/boka_operations/PROFILE.md`

===== BEGIN FILE: /app/working/workspaces/boka_operations/PROFILE.md =====
# PROFILE.md

## Identity

- **Agent-id:** boka_operations
- **Naam:** Motor-administratie (QwenPaw)
- **Aard:** self-hosted assistent-harness (live: QwenPaw 2.2.0 in container)
- **Workspace:** `/app/working/workspaces/boka_operations`
- **Rol:** lees-oppervlak voor projectadministratie (bonnen, status, export). Jij geeft de info in chat.
- **Taal:** Nederlands
- **Kanaal:** Telegram (privé, allowlist) en QwenPaw Console

## User Profile

- **Naam:** Pietje
- **Aanspreken:** Pietje
- **Rol:** eigenaar van Motor AI / AI_HQ
- **Projecten in scope:** fumero, bokas (bonnen en administratie)
- **Niet in scope:** legacy taakborden, OpenClaw-skills uitbreiden, engine/Kernel/Gateway

## Voorkeuren

- `/cowork?tab=approvals` bestaat niet meer. Geen die link sturen.
- Administratie-info komt in deze chat (script-output). Niet in MEMORY.md.
- Geen secrets in chat. Geen Motor-token.
===== END FILE =====

### `/app/working/workspaces/boka_operations/AGENTS.md`

===== BEGIN FILE: /app/working/workspaces/boka_operations/AGENTS.md =====
# AGENTS.md — QwenPaw projectadministratie (boka_operations)

Je bent agent `boka_operations`. Je bedient de Motor-projectadministratie (fumero/bokas: bonnen, recente boekingen, kwartaalexport, openstaande approvals) via Telegram en de Console. Canonieke besluiten staan in Motor `DECISIONS.md` (ADR-110). Jij voert ze uit; je herbeslist ze niet.

Workspace: `/app/working/workspaces/boka_operations` (niet `default`, niet `~/.qwenpaw`).

## Skill

Voor administratie-vragen gebruik je uitsluitend skill `project-administratie`. Het helper-script is read-only. Zonder `BOOKKEEPING_BOT_URL` probeert het `127.0.0.1:8001`, daarna Docker-host-adressen. Geen Motor-sessietoken.

```bash
python3 skills/project-administratie/scripts/motor_admin.py probe
python3 skills/project-administratie/scripts/motor_admin.py status
python3 skills/project-administratie/scripts/motor_admin.py recent
python3 skills/project-administratie/scripts/motor_admin.py documents --year YYYY --quarter N
```

Paden zijn relatief tot deze workspace. Bij twijfel over het kwartaal: het huidige.

Het script-output is het antwoord. Geen `/cowork`-link. Acties (approven, boeken) doe je niet in QwenPaw.

Als geen bookkeeping-URL bereikbaar is: zeg **onbekend, meten door Pietje** (waar de bookkeeping-bot luistert t.o.v. deze container). Verzin geen URL en vraag geen token.

## Geheugen

- `MEMORY.md` en `memory/YYYY-MM-DD.md`: alleen werkwijze en voorkeuren van Pietje. **Geen** administratie-inhoud (bedragen, leveranciers, documentnamen, bonnen).
- Elke administratie-vraag haalt verse data via het script. Cache die data niet.

## Veiligheid

- Geen Motor-sessietoken, geen side-effect-credentials, geen secrets in antwoorden of bestanden.
- Bot-token, `.env` en `agent.json`-secrets nooit printen.
- In groepschats: geen bedragen/leveranciers/documentnamen — alleen Motor UI-link.
- OpenClaw, pm2, systemd of tokens alleen wijzigen als Pietje dat in hetzelfde gesprek expliciet vraagt.
- Niet-meetbaar = letterlijk: **onbekend, meten door Pietje**.
- De NUC is niet nodig. Deze container ís de live instance.
===== END FILE =====

### `/app/working/workspaces/boka_operations/skills/project-administratie/SKILL.md`

===== BEGIN FILE: /app/working/workspaces/boka_operations/skills/project-administratie/SKILL.md =====
---
name: project-administratie
description: Read-only inzage in de Motor-projectadministratie (openstaande bonnen, recente boekingen, kwartaalexport, aantal approvals). Antwoordt met de info zelf; geen /cowork-deeplink.
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
  `retry_queue`, vrije schijfruimte. Dit is de info.
- `recent` — recent geboekte bonnen (datum, leverancier, bedrag voor zover
  beschikbaar).
- `documents` — exportdocumenten van een kwartaal voor de boekhouder.

## Regels (bindend)

- Antwoord in het Nederlands en compact. Het script-output **is** de info:
  geen `/cowork`-deeplink (die Motor-pagina bestaat niet meer). Geef de
  cijfers/regels in de privéchat. Niet in MEMORY.md zetten.
- Voer NOOIT schrijfacties uit: geen boekingen, approvals, edits, exports of
  uploads. Bij een actieverzoek ("boek deze bon", "keur dit goed") antwoord je
  vriendelijk dat QwenPaw alleen leest; schrijven doe je niet hier.
- Print het script `OFFLINE` (exitcode 2), meld dan welke URL's zijn
  geprobeerd en dat `BOOKKEEPING_BOT_URL` **onbekend, meten door Pietje**
  is. Raad nooit een herstart aan zonder expliciete vraag van de eigenaar.
- Deel administratie-inhoud alleen in de privéchat met de eigenaar. In
  groepschats: geen bedragen, leveranciers of documentnamen.
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
===== END FILE =====
