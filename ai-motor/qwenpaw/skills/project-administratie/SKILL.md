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
