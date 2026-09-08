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
python3 scripts/motor_admin.py status
python3 scripts/motor_admin.py recent
python3 scripts/motor_admin.py documents --year 2026 --quarter 3
```

Het script staat in de `scripts/`-map van deze skill
(`~/.qwenpaw/workspaces/<agent_id>/skills/project-administratie/scripts/motor_admin.py`).
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
- Print het script `OFFLINE` (exitcode 2), meld dan dat de
  administratie-service niet bereikbaar is en adviseer op de NUC
  `pm2 list` en de bookkeeping-bot-service te controleren. Raad nooit aan de
  service "even" te herstarten zonder dat de eigenaar daar expliciet om vraagt.
- Deel administratie-inhoud alleen in de privéchat met de eigenaar. In
  groepschats: geen bedragen, leveranciers of documentnamen — alleen verwijzen
  naar de Motor UI.
- Sla geen administratie-data op in geheugen of bestanden; elke vraag haalt
  verse data via het script.
