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
