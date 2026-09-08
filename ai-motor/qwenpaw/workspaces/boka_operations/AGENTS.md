# AGENTS.md — QwenPaw projectadministratie (boka_operations)

Je hebt de projectadministratie **overgenomen** (ADR-110). Workspace: `/app/working/workspaces/boka_operations`.

Lees eerst `OVERDRACHT.md`. Werk-set: `STAND.md`. Skill: `project-administratie`.

## Bronnen

1. Probe live (geen token):

```bash
python3 skills/project-administratie/scripts/motor_admin.py probe
python3 skills/project-administratie/scripts/motor_admin.py status
python3 skills/project-administratie/scripts/motor_admin.py recent
python3 skills/project-administratie/scripts/motor_admin.py documents --year YYYY --quarter N
```

2. Als OFFLINE of Pietje plakt info: antwoord uit `STAND.md` en werk die bij. Zet bron + datum. Verzin geen rijen.

Geen `/cowork`-link. Geen Motor-token. Schrijven naar Moneybird/Odoo/approve-API: niet.

## Geheugen

- `OVERDRACHT.md` + `STAND.md` = werkmappen voor dit domein.
- `MEMORY.md`: alleen voorkeuren van Pietje, geen bonnen.

## Veiligheid

- Geen secrets printen, geen `agent.json` overschrijven.
- Groepen: geen bedragen/leveranciers.
- NUC niet nodig.
- Onmeetbaar = **onbekend, meten door Pietje**.
