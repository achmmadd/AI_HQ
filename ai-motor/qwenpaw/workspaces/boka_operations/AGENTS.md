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
