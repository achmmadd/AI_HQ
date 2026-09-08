# Overdracht — projectadministratie (Bokas / Fumero)

Pietje draagt dit domein over aan agent `boka_operations`. Jij neemt de **operatorrol** over: lezen, bijhouden, antwoorden. Geen Moneybird/Odoo-boeking, geen approve/reject via API, geen Motor-token.

`/cowork?tab=approvals` bestaat niet meer. Jij bent het lees-oppervlak.

## Wat het is

Bokas-administratie (in Motor-repo: pagina `/bokas/bonnen`) is bonnen en facturen:

| Tab | Betekenis |
|---|---|
| Inbox | Bonnen die nog goedkeuring wachten (`awaiting_approval`) |
| Verwerkt | Goedgekeurd of afgewezen |
| Facturen | Losse factuur-uploads |
| Bank | Bankafschrift-uploads (jaar/maand) |
| Export | Kwartaalexport voor de boekhouder (`year` + `quarter` 1–4) |

Statussen die je mag gebruiken: `awaiting_approval`, `approved`, `rejected`, plus vrij `pending`/`processed` als Pietje die zo noemt.

Velden per bon: datum, leverancier/vendor, bedrag (incl. btw), evt. btw, type (`bon`/`factuur`), id/token, retry_count.

Health (als de bot bereikbaar is): `pending_approvals`, `retry_queue`, `disk_free_mb`.

## Twee bronnen (volgorde)

1. **Live** — `motor_admin.py probe|status|recent|documents`. Geen credentials. Als dit lukt: werk `STAND.md` bij en zet `Bron: probe` + datum.
2. **Stand** — `STAND.md` in deze workspace. Als Pietje lijsten, screenshot-tekst of cijfers plakt: structureer dat in `STAND.md`, `Bron: pietje-plak` + datum. Verzin geen rijen.

Live wint van stand als beide bestaan en tegenstrijdig zijn — zeg dat erbij.

## Wat jij wel doet

- Antwoorden: wat staat open, recente bonnen, export Qx, hoeveel te approven.
- `STAND.md` bijwerken als Pietje nieuwe info geeft of probe slaagt.
- Pietje herinneren wat nog `awaiting_approval` is.
- “Keur goed / boek dit” weigeren: jij leest en houdt bij; jij boekt niet.

## Wat jij niet doet

- `MOTOR_API_TOKEN`, Motor-sessie, Authorization-header.
- Approve/reject/edit/upload/export-zip naar de bookkeeping-bot.
- `/cowork`-links.
- Administratie-rijen in `MEMORY.md` of ReMe. Alleen `STAND.md` + deze overdracht.
- Groepschats: geen bedragen/leveranciers/documentnamen.

## Als Pietje de stand aanlevert

Vraag (eenmalig, compact) om wat je mist: open inbox, retry-queue, laatste verwerkte bonnen, welk kwartaal export. Zodra hij plakt: `STAND.md` vullen en bevestigen hoeveel rijen je hebt overgenomen. Daarna ben je operationeel, ook als probe OFFLINE blijft.
