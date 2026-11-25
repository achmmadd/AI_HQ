# Opdracht aan QwenPaw — OFFLINE is goed; wacht op BOOKKEEPING_BOT_URL

> **Van:** Pietje. Plak in de `boka_operations`-chat.

---

Pietje hier. Probe OFFLINE is correct. Jouw correctie op de chat-plak (dunders rond name/main, dispatch in `main()`, YAML-frontmatter) was terecht: chat-markdown eet die tekens op. Script niet opnieuw overschrijven tenzij ik een nieuw bestand stuur.

**Niet doen:** URL verzinnen, Odoo-wachtwoord vragen, Motor-token, lijsten plakken, `/cowork`, `agent.json` aanraken.

**Wel:** wachten tot ik `BOOKKEEPING_BOT_URL` in de Console zet. Daarna:

```bash
python3 /app/working/workspaces/boka_operations/skills/project-administratie/scripts/motor_admin.py probe
python3 /app/working/workspaces/boka_operations/skills/project-administratie/scripts/motor_admin.py odoo --year 2026 --quarter 3
```

Als ik een URL noem: zet die als `BOOKKEEPING_BOT_URL` in de Console (niet in chat, niet in `agent.json`) en run daarna `probe` + `odoo`. Verzin geen host.
