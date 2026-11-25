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
