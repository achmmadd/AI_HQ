# Infra-project — QwenPaw ↔ bookkeeping-bot (Odoo-leespad)

> **Eigenaar:** Pietje · **Datum:** 2026-10-20 · **Voor:** infra / operator
> **Besluit:** [ADR-110](DECISIONS.md) · **Runbook:** [qwenpaw-migratie.md](qwenpaw-migratie.md) · **Staat:** [00-HUIDIGE-STAAT](architecture-2.2/00-HUIDIGE-STAAT.md)
> **PR:** https://github.com/achmmadd/AI_HQ/pull/14

## Doel (één zin)

Zorg dat de QwenPaw-container (`boka_operations`) de bookkeeping-bot kan bereiken, zodat `motor_admin.py odoo` Odoo-facturen kan lezen. Geen nieuwe stack, geen Motor-token, geen publieke poort.

## Context (al gedaan — niet opnieuw)

| Feit | Status |
|---|---|
| QwenPaw 2.2.0, agent `boka_operations`, Docker | Live (hostname gemeten: `cc22d51c27ac`) |
| Skill `project-administratie` + `motor_admin.py odoo` | Live in die workspace |
| Facturenbron | **Odoo** via bot `GET /odoo/bills` (zelfde pad als Motor `/bokas/bonnen`) |
| Probe vanaf QwenPaw | **OFFLINE** — refused op `127.0.0.1:8001`, `host.docker.internal:8001`, `172.17.0.1:8001` |
| Wat ontbreekt | `BOOKKEEPING_BOT_URL` die **vanaf die container** werkt |

Repo-plan: bot op Motor-host (docs: NUC) `:8001`. Dat is **geen** bewijs dat die host nu luistert of bereikbaar is vanaf QwenPaw.

## Scope — wel

1. **Vinden/starten** bookkeeping-bot op de juiste host (poort 8001 of wat live geldt).
2. **Meten** of `GET /health` en `GET /odoo/bills?year=2026&quarter=3` daar werken (geen secrets in logs).
3. **Pad naar QwenPaw** kiezen: URL die de QwenPaw-container kan bereiken (vaak Tailscale-IP/host van de bot-host + poort). Bind niet alleen op loopback als QwenPaw elders staat.
4. **Zetten** in QwenPaw Console: env `BOOKKEEPING_BOT_URL=http://…:8001` (geen chat, `agent.json` niet overschrijven).
5. **Acceptatietest** in QwenPaw (of door Pietje laten plakken):

```bash
python3 /app/working/workspaces/boka_operations/skills/project-administratie/scripts/motor_admin.py probe
python3 /app/working/workspaces/boka_operations/skills/project-administratie/scripts/motor_admin.py odoo --year 2026 --quarter 3
```

Verwacht: geen OFFLINE; JSON/regels met Odoo-facturen of “geen facturen voor …” (dat is ook succes).

6. **Terugkoppeling** naar Pietje: welke host, welke URL (zonder wachtwoorden), `curl`-bewijs `/health`, probe-output.

## Scope — niet

| Niet | Waarom |
|---|---|
| Odoo-wachtwoord in QwenPaw | Credentials blijven op de bot |
| `MOTOR_API_TOKEN` / `MOTOR_API_URL` | Verboden (ADR-110) |
| `:8001` op internet / Cloudflare | Alleen Tailscale of vergelijkbaar private pad |
| Approve/boek/write vanuit QwenPaw | Alleen lezen tot Gateway |
| Nieuwe orchestrator, staging-stack, NUC “verplicht maken” | ADR-110: NUC niet nodig voor QwenPaw-kanaal |
| Telegram-token in chat / `agent.json` overschrijven | Console-only door eigenaar |
| Factuurlijsten van Pietje plakken | Data zit in Odoo |

## Meetstappen (infra)

### A — Bot-host (waar Motor/bookkeeping hoort)

```bash
curl -sS -m 5 http://127.0.0.1:8001/health
curl -sS -m 10 "http://127.0.0.1:8001/odoo/bills?year=2026&quarter=3" | head -c 500
ss -ltn | grep 8001 || true
# Bind-adres: luistert het alleen op 127.0.0.1 of ook op Tailscale?
```

| Uitslag | Actie |
|---|---|
| `/health` JSON | Bot leeft. Ga naar B. |
| connection refused | Bot starten of juiste poort vinden. Geen URL verzinnen. |
| Alleen `127.0.0.1` | QwenPaw ziet hem niet. Bind op Tailscale-IP of private bridge — **besluit + rollback** met Pietje. Geen publieke openstelling. |

### B — Pad vanaf QwenPaw-container

Vanuit de QwenPaw-host/container (niet gokken):

```bash
# Vervang DOEL door Tailscale-IP of MagicDNS van de bot-host
curl -sS -m 5 http://DOEL:8001/health
```

Werkt dat → die URL is kandidaat voor `BOOKKEEPING_BOT_URL`.

### C — Console

QwenPaw Console → env voor agent/workspace `boka_operations`:

```
BOOKKEEPING_BOT_URL=http://DOEL:8001
```

Geen Motor-sessie. Geen Odoo-URL. Geen token in chat.

### D — Acceptatie

`probe` bereikbaar + `odoo --year 2026 --quarter 3` geen OFFLINE. Output (zonder secrets) delen met Pietje. Daarna in chat: inhoud van [`../qwenpaw/OPDRACHT-BOT-URL.md`](../qwenpaw/OPDRACHT-BOT-URL.md) zodat de agent opnieuw runt.

## Klaar wanneer

- [ ] `/health` op bot-host groen (commandoutput)
- [ ] `/odoo/bills?year=2026&quarter=3` bereikbaar vanaf bot-host (geen secrets)
- [ ] Zelfde `/health` bereikbaar **vanaf QwenPaw-container** via gekozen URL
- [ ] `BOOKKEEPING_BOT_URL` gezet in Console (niet in git)
- [ ] `motor_admin.py probe` + `odoo` in QwenPaw niet OFFLINE
- [ ] `00-HUIDIGE-STAAT.md` bijgewerkt met meetdatum + URL-vorm (host/Tailscale, geen secrets)

## Rollback

1. `BOOKKEEPING_BOT_URL` uit QwenPaw Console verwijderen → probe weer OFFLINE (veilig).
2. Bind-wijziging op de bot terugzetten naar vorige luister-adressen.
3. Geen DB-rollback; skill is read-only.

## Contact / bronnen

- Runbook detail: [qwenpaw-migratie.md](qwenpaw-migratie.md) stap 4b
- Agent-opdracht na URL: [`../qwenpaw/OPDRACHT-BOT-URL.md`](../qwenpaw/OPDRACHT-BOT-URL.md)
- Hybrid-topologie (plan): [hybrid-env.md](hybrid-env.md) — NUC bookkeeping `:8001`
