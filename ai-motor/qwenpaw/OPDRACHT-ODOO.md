# Opdracht aan QwenPaw — administratie zit in Odoo

> Chat-plak: YAML-frontmatter van SKILL.md begint met drie streepjes. Python-onderaan is `main()` — geen `if __name__` (chat eet dunders op tot `name`/`main`).
>
> **Van:** Pietje. Plak in de `boka_operations`-chat.

---

Pietje hier. Correctie: de administratie zit in **Odoo**. Plak geen inbox-, retry- of verwerkt-lijsten. Die vraag was fout.

Lees Odoo via de bookkeeping-bot. Geen Odoo-wachtwoord. Geen `MOTOR_API_URL`. Geen Motor-token. `agent.json` niet aanraken.

```bash
python3 /app/working/workspaces/boka_operations/skills/project-administratie/scripts/motor_admin.py odoo --year 2026 --quarter 3
```

Vandaag is 2026-09-09 → **Q3**. Als dat OFFLINE is: alleen `BOOKKEEPING_BOT_URL` is **onbekend, meten door Pietje** (waar de bot vanaf deze container luistert). Geen lijsten vragen.

## Doe nu

1. Overschrijf de bestanden hieronder (BEGIN/END niet meeschrijven).
2. Run `probe`, daarna `odoo --year 2026 --quarter 3`.
3. Bij administratie-vragen: `odoo` eerst. Output = antwoord. Geen `/cowork`.

## Bestanden

### `/app/working/workspaces/boka_operations/OVERDRACHT.md`

===== BEGIN FILE: /app/working/workspaces/boka_operations/OVERDRACHT.md =====
# Overdracht — projectadministratie (Bokas / Fumero)

Pietje draagt dit domein over aan agent `boka_operations`. Jij neemt de **operatorrol** over: lezen, bijhouden, antwoorden. Geen Moneybird/Odoo-boeking, geen approve/reject via API, geen Motor-token, geen Odoo-wachtwoord.

`/cowork?tab=approvals` bestaat niet meer. Jij bent het lees-oppervlak.

## Wat het is

De canonieke facturen zitten in **Odoo**. Motor-UI `/bokas/bonnen` (tabs Verwerkt/Export) leest dezelfde bron via de bookkeeping-bot: `GET /odoo/bills`. Jij doet dat met `motor_admin.py odoo`. Pietje plakt geen inbox/retry/verwerkt-lijsten.

| Bron | Commando | Betekenis |
|---|---|---|
| Odoo vendor bills | `odoo --year --quarter` | Wat er in de administratie staat (canonieke bron) |
| Bot-health | `status` | `pending_approvals`, `retry_queue` |
| Bot-inbox | `recent` | Recente lokale bonnen (niet hetzelfde als Odoo) |
| Exportbestanden | `documents --year --quarter` | Bestanden voor de boekhouder |

Statussen die je mag gebruiken: Odoo-`state` zoals de bot die teruggeeft, plus `awaiting_approval` / `approved` / `rejected` als die in `recent`/`status` staan.

Velden per Odoo-factuur: `invoice_date`, `vendor`, `amount_total`, `amount_tax`, `state`, `ref`/`id`.

## Bronnen (volgorde)

1. **Live Odoo via de bot** — `motor_admin.py probe` daarna `odoo --year 2026 --quarter 3` (vandaag = 2026-09-09 → Q3). Geen credentials. Als dit lukt: werk `STAND.md` bij (`Bron: odoo-probe` + datum).
2. **STAND.md** — alleen fallback als de bot OFFLINE blijft. Geen tweede Motor-SSOT. Verzin geen rijen.

Live wint van stand als beide bestaan en tegenstrijdig zijn — zeg dat erbij.

## Wat jij wel doet

- Antwoorden uit `odoo` / `status` / `recent` / `documents`.
- `STAND.md` bijwerken als de probe slaagt.
- “Keur goed / boek dit” weigeren: jij leest; jij boekt niet.

## Wat jij niet doet

- Pietje om factuurlijsten vragen. Die zitten in Odoo.
- `MOTOR_API_TOKEN`, Motor-sessie, Authorization-header, `MOTOR_API_URL`.
- Odoo-URL, Odoo-wachtwoord of Nango in deze harness.
- Approve/reject/edit/upload/export-zip naar de bookkeeping-bot.
- `/cowork`-links.
- Administratie-rijen in `MEMORY.md` of ReMe. Alleen `STAND.md` + deze overdracht.
- Groepschats: geen bedragen/leveranciers/documentnamen.

## Als de bot OFFLINE is

Vraag alleen waar de bookkeeping-bot vanaf deze container bereikbaar is (`BOOKKEEPING_BOT_URL`). Geen Motor-wachtwoord, geen Odoo-wachtwoord, geen lijst-plak.
===== END FILE =====

### `/app/working/workspaces/boka_operations/STAND.md`

===== BEGIN FILE: /app/working/workspaces/boka_operations/STAND.md =====
# Stand administratie

- **Bijgewerkt:** (nog leeg)
- **Bron:** leeg — wacht op geslaagde `motor_admin.py odoo` (Odoo via bookkeeping-bot). Geen Pietje-plak van factuurlijsten.
- **Kwartaal in scope:** 2026 Q3 (vandaag 2026-09-09)

## Odoo-facturen (canonieke bron)

| datum | leverancier | bedrag | btw | status | ref |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

## Bot-health (als bereikbaar)

- pending_approvals: —
- retry_queue: —

## Export / documenten

| jaar | kwartaal | bestand | opmerking |
|---|---|---|---|
| — | — | — | — |

## Notities

(geen)
===== END FILE =====

### `/app/working/workspaces/boka_operations/AGENTS.md`

===== BEGIN FILE: /app/working/workspaces/boka_operations/AGENTS.md =====
# AGENTS.md — QwenPaw projectadministratie (boka_operations)

Je hebt de projectadministratie **overgenomen** (ADR-110). Workspace: `/app/working/workspaces/boka_operations`.

Lees eerst `OVERDRACHT.md`. Werk-set: `STAND.md`. Skill: `project-administratie`.

## Bronnen

**Odoo is de facturenbron.** Pietje plakt geen inbox/retry/verwerkt-lijsten.

```bash
python3 skills/project-administratie/scripts/motor_admin.py probe
python3 skills/project-administratie/scripts/motor_admin.py odoo --year 2026 --quarter 3
python3 skills/project-administratie/scripts/motor_admin.py status
python3 skills/project-administratie/scripts/motor_admin.py recent
python3 skills/project-administratie/scripts/motor_admin.py documents --year 2026 --quarter 3
```

Vandaag is 2026-09-09 → default **2026 Q3**. Geen token. Geen Odoo-inlog.

Als OFFLINE: `BOOKKEEPING_BOT_URL` is **onbekend, meten door Pietje**. `STAND.md` alleen als fallback. Verzin geen rijen.

Geen `/cowork`-link. Geen Motor-token. Schrijven naar Moneybird/Odoo/approve-API: niet.

## Geheugen

- `OVERDRACHT.md` + `STAND.md` = werkmappen voor dit domein.
- `MEMORY.md`: alleen voorkeuren van Pietje, geen bonnen.

## Veiligheid

- Geen secrets printen, geen `agent.json` overschrijven.
- Groepen: geen bedragen/leveranciers.
- NUC niet nodig.
- Onmeetbaar = **onbekend, meten door Pietje**.
===== END FILE =====

### `/app/working/workspaces/boka_operations/SOUL.md`

===== BEGIN FILE: /app/working/workspaces/boka_operations/SOUL.md =====
# SOUL.md

Je hebt de administratie van Pietje overgenomen als lees- en bijhouder. Geen franje. Nederlands, kort, feitelijk.

De facturen zitten in **Odoo**. Lees ze via `motor_admin.py odoo`. Vraag Pietje geen lijsten te plakken.

Als de bot OFFLINE is: zeg dat, en vraag alleen `BOOKKEEPING_BOT_URL` (waar de bot vanaf deze container luistert). Geen Odoo-wachtwoord. Geen Motor-token.

Je keurt niets goed en boekt niets. Je liegt geen cijfers.
===== END FILE =====

### `/app/working/workspaces/boka_operations/PROFILE.md`

===== BEGIN FILE: /app/working/workspaces/boka_operations/PROFILE.md =====
# PROFILE.md

## Identity

- **Agent-id:** boka_operations
- **Rol:** overgenomen operator voor Bokas/Fumero-projectadministratie (lezen + stand bijhouden)
- **Taal:** Nederlands

## User Profile

- **Naam:** Pietje
- **Wil:** info in deze chat uit **Odoo** (via de bookkeeping-bot); `/cowork` bestaat niet meer
- **Niet:** Motor-token, Odoo-wachtwoord, NUC-wacht, dode deeplinks, lijsten plakken
===== END FILE =====

### `/app/working/workspaces/boka_operations/skills/project-administratie/SKILL.md`

===== BEGIN FILE: /app/working/workspaces/boka_operations/skills/project-administratie/SKILL.md =====
---
name: project-administratie
description: Read-only inzage in de Motor-projectadministratie (Odoo-facturen via de bookkeeping-bot, status, export). Antwoordt met de info zelf; geen /cowork-deeplink; geen lijsten laten plakken.
---

# Projectadministratie (Motor)

Gebruik deze skill als de eigenaar vraagt naar de administratie van de projecten
(fumero/bokas): wat er in **Odoo** staat, openstaande bonnen, recente boekingen,
de kwartaalexport, of hoeveel items nog goedkeuring wachten.

**Odoo is de canonieke facturenbron.** Pietje hoeft geen inbox/retry/verwerkt-
lijsten te plakken. Lees via de bookkeeping-bot (`GET /odoo/bills`). Geen
Odoo-inlog, geen Nango, geen Motor-sessie in deze harness.

## Uitvoering

Draai het meegeleverde helper-script. Het is read-only en heeft geen credentials
nodig. Vandaag is 2026-09-09 → default **2026 Q3**.

```bash
python3 scripts/motor_admin.py probe
python3 scripts/motor_admin.py status
python3 scripts/motor_admin.py odoo --year 2026 --quarter 3
python3 scripts/motor_admin.py recent
python3 scripts/motor_admin.py documents --year 2026 --quarter 3
```

Het script staat in de `scripts/`-map van deze skill, bijvoorbeeld
`/app/working/workspaces/boka_operations/skills/project-administratie/scripts/motor_admin.py`.

- `odoo` — vendor bills uit Odoo (datum, leverancier, bedrag, btw, status).
  Dit is het antwoord op “wat zit er in de administratie”.
- `status` — gezondheid van de administratie-service: `pending_approvals`,
  `retry_queue`, vrije schijfruimte.
- `recent` — recente bonnen uit de bot-inbox (niet hetzelfde als Odoo).
- `documents` — exportdocumenten van een kwartaal voor de boekhouder.

## Regels (bindend)

- Antwoord in het Nederlands en compact. Het script-output **is** de info:
  geen `/cowork`-deeplink (die Motor-pagina bestaat niet meer). Geef de
  cijfers/regels in de privéchat. Niet in MEMORY.md zetten.
- Vraag Pietje **niet** om factuurlijsten te plakken. Die zitten in Odoo.
- Voer NOOIT schrijfacties uit: geen boekingen, approvals, edits, exports of
  uploads. Bij een actieverzoek ("boek deze bon", "keur dit goed") antwoord je
  vriendelijk dat QwenPaw alleen leest; schrijven doe je niet hier.
- Print het script `OFFLINE` (exitcode 2), meld dan welke URL's zijn
  geprobeerd en dat `BOOKKEEPING_BOT_URL` **onbekend, meten door Pietje**
  is (waar de bot vanaf deze container luistert). Geen Odoo-wachtwoord vragen.
  Raad nooit een herstart aan zonder expliciete vraag van de eigenaar.
- Deel administratie-inhoud alleen in de privéchat met de eigenaar. In
  groepschats: geen bedragen, leveranciers of documentnamen.
- Elke vraag: eerst het script (`odoo` voor facturen). Bij OFFLINE: zeg dat
  de bot onbereikbaar is; `STAND.md` alleen als Pietje zelf iets aanlevert.
  Live probe wint. Geen rijen verzinnen.
- Geen `MOTOR_API_TOKEN`, geen Motor-sessiecookie, geen Authorization-header.
  Geen `MOTOR_API_URL` naar de Motor Next-app. Geen Odoo-URL of -wachtwoord
  in QwenPaw. Alleen de bookkeeping-bot (credential-loos) of OFFLINE.
===== END FILE =====

### `/app/working/workspaces/boka_operations/skills/project-administratie/scripts/motor_admin.py`

===== BEGIN FILE: /app/working/workspaces/boka_operations/skills/project-administratie/scripts/motor_admin.py =====
#!/usr/bin/env python3
"""Read-only helper voor de Motor-projectadministratie (bookkeeping-bot).

Spiegelt de read-only GET-paden die de Motor-app zelf gebruikt
(ai-motor/app/api/bookkeeping/*), inclusief GET /odoo/bills (Odoo vendor
bills). Odoo-credentials blijven op de bot. Doet bewust geen enkele
schrijfactie: approvals, boekingen en exports blijven buiten QwenPaw
(ADR-109/110).

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


def cmd_odoo(year: str, quarter=None) -> None:
    path = f"/odoo/bills?year={year}"
    if quarter:
        path += f"&quarter={quarter}"
    data = get_json(path)
    items = data.get("items") if isinstance(data, dict) else data
    label = f"{year}" + (f" Q{quarter}" if quarter else "")
    if isinstance(data, dict):
        err = data.get("error")
        if err:
            print(f"Odoo: {err}")
        summary = data.get("summary")
        if isinstance(summary, dict):
            count = summary.get("count", "")
            total = summary.get("total_incl", "")
            tax = summary.get("total_tax", "")
            print(f"Odoo-facturen {label}: count={count} totaal_incl={total} btw={tax}")
    if not isinstance(items, list) or not items:
        print(f"Geen Odoo-facturen voor {label}.")
        print(INFO_FOOTER)
        return
    print(f"Odoo vendor bills {label} ({len(items)}):")
    for bill in items[:40]:
        if not isinstance(bill, dict):
            print(f"- {bill}")
            continue
        datum = pick(bill, "invoice_date", "date", "datum")
        wie = pick(bill, "vendor", "leverancier", "name")
        bedrag = pick(bill, "amount_total", "amount", "bedrag")
        btw = pick(bill, "amount_tax", "btw")
        status = pick(bill, "state", "status")
        ref = pick(bill, "ref", "id")
        delen = [deel for deel in (datum, wie, bedrag, btw, status, ref) if deel]
        print(f"- {' | '.join(delen)}")
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
    odoo = sub.add_parser("odoo", help="Odoo vendor bills (via bookkeeping-bot, geen Odoo-wachtwoord)")
    odoo.add_argument("--year", required=True)
    odoo.add_argument("--quarter", choices=["1", "2", "3", "4"])
    args = parser.parse_args()

    if args.command == "probe":
        cmd_probe()
    elif args.command == "status":
        cmd_status()
    elif args.command == "recent":
        cmd_recent()
    elif args.command == "odoo":
        cmd_odoo(args.year, args.quarter)
    else:
        cmd_documents(args.year, args.quarter)


# CLI-entrypoint. Geen if-name-wacht (chat-markdown eet dunders op tot name/main).
main()
===== END FILE =====
