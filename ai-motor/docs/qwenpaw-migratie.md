# Runbook — QwenPaw-migratie: projectadministratie + Telegram

> **Eigenaar:** Pietje · **Datum:** 2026-09-08
> **Besluit:** [ADR-110](DECISIONS.md) · **Staat:** [00-HUIDIGE-STAAT](architecture-2.2/00-HUIDIGE-STAAT.md) · **Delta:** [doc 15 §41.10–41.12](architecture-2.2/15-review-panel.md)
> **Artefacten:** [`../qwenpaw/`](../qwenpaw/)
> **Live target:** agent `boka_operations`, workspace `/app/working/workspaces/boka_operations` (QwenPaw 2.2.0, Docker)

## Doel en scope

De eigenaar bedient de projectadministratie (bonnen/administratie per project, fumero/bokas) via Telegram op QwenPaw. **De NUC is niet nodig.** Runtime = de bestaande Docker-instance, agent `boka_operations`. Hetzner blijft durable control; Motor UI blijft de plek voor schrijfacties.

Wat de skill **wel** doet (read-only, R0):

- `probe` — welke bookkeeping-URL bereikbaar is (loopback, daarna Docker-host);
- status (`pending_approvals`, `retry_queue`, disk);
- recent geboekte bonnen;
- exportdocumenten per kwartaal;
- deeplinks naar de Motor UI.

Wat **niet** verandert:

- Boeken, approven, editen en exporteren blijven in de Motor UI (ADR-109, AM-4).
- Geen Motor-sessietoken en geen side-effect-credentials in de QwenPaw-context.
- QwenPaw is geen orchestrator en geen memorylaag voor Motor-data (ADR-105/107/108).
- Motor-notificaties via `lib/telegram.ts` (`sendMessage`) mogen hetzelfde bot-token gebruiken.

## Opdracht aan QwenPaw

- Eerste keer / nieuwe chat: [`../qwenpaw/OPDRACHT.md`](../qwenpaw/OPDRACHT.md)
- Agent die nog op de NUC wacht: eerst [`../qwenpaw/OPDRACHT-NUC-NIET-NODIG.md`](../qwenpaw/OPDRACHT-NUC-NIET-NODIG.md), daarna [`../qwenpaw/OPDRACHT-VERVOLG.md`](../qwenpaw/OPDRACHT-VERVOLG.md) (skill + persona, omdat de git-repo in de container ontbreekt).

Persona voor deze agent:

- [`../qwenpaw/workspaces/boka_operations/AGENTS.md`](../qwenpaw/workspaces/boka_operations/AGENTS.md)
- [`../qwenpaw/workspaces/boka_operations/SOUL.md`](../qwenpaw/workspaces/boka_operations/SOUL.md)
- [`../qwenpaw/workspaces/boka_operations/PROFILE.md`](../qwenpaw/workspaces/boka_operations/PROFILE.md)

## Voorwaarden

1. QwenPaw 2.2.0 bereikbaar (gemeten: container, agent `boka_operations`).
2. Bookkeeping-bot ergens bereikbaar vanaf die container, of de probe mag `OFFLINE` rapporteren.
3. Toegang tot @BotFather en het Telegram-user-id van de eigenaar voor de allowlist.

## Stap 1 — Nulmeting

Al gedaan voor versie/host/agent (zie 00-HUIDIGE-STAAT). Residual: Telegram-allowlist, bookkeeping-bereik, en alleen indien nodig een tweede poller op hetzelfde bot-token.

## Stap 2 — Telegram-token roteren en verhuizen

Eén bot-token mag niet door twee pollers tegelijk. Eerst roteren, dan verhuizen:

1. @BotFather: `/revoke` → nieuw token (secrets-store, niet git).
2. `/setprivacy` ENABLED, `/setjoingroups` DISABLED.
3. Motor `.env.local` (`TELEGRAM_BOT_TOKEN`) bijwerken voor notificaties.
4. Merge [`../qwenpaw/agent.json.example`](../qwenpaw/agent.json.example) in `/app/working/workspaces/boka_operations/agent.json` (niet overschrijven). `allow_from` = alleen eigenaar-user-id. Of Console → Control → Channels → Telegram.
5. Opslaan / herladen.

## Stap 3 — Tweede poller (alleen als die bestaat)

Geen NUC-werk. Als dezelfde Telegram-bot nog via OpenClaw antwoordt: dat kanaal daar uitzetten zodat er één poller overblijft. Als OpenClaw dit token niet pollen, sla deze stap over.

## Stap 4 — Skill installeren

Voorkeur: de agent schrijft de bestanden via OPDRACHT-VERVOLG. Handmatig in de container:

```bash
WS=/app/working/workspaces/boka_operations
# bestanden uit OPDRACHT-VERVOLG.md naar $WS/...
qwenpaw skills enable project-administratie --agent-id boka_operations
qwenpaw skills list --status enabled --agent-id boka_operations
```

Optioneel: `BOOKKEEPING_BOT_URL` (alleen als probe alle kandidaten mist) en `MOTOR_UI_BASE` (default `https://motorsai.app`). Geen sessietoken.

## Stap 5 — Testen

```bash
WS=/app/working/workspaces/boka_operations/skills/project-administratie/scripts
python3 $WS/motor_admin.py probe
python3 $WS/motor_admin.py status
python3 $WS/motor_admin.py recent
python3 $WS/motor_admin.py documents --year 2026 --quarter 3
```

`OFFLINE` + exit 2 is geldig degradatiegedrag. Telegram-vraag: *"Wat staat er nog open in de administratie?"* — cijfers of OFFLINE + deeplink. “Keur goed” moet geweigerd worden met Motor UI-link.

## Stap 6 — Documentatie

Meetresultaten in 00-HUIDIGE-STAAT; ADR-110-acceptatie afvinken met bewijs. Bij AM-4: QwenPaw + modelprovider in het verwerkingsregister.

## Rollback

1. `channels.telegram.enabled: false` in de `boka_operations`-`agent.json`, herladen.
2. Als OpenClaw het token eerder pollen: dat kanaal daar weer aan en token roteren. Geen NUC-verplichting.
3. `qwenpaw skills disable project-administratie --agent-id boka_operations`. Geen DB-rollback nodig.

## Acceptatie (spiegelt ADR-110)

- [ ] `boka_operations` heeft skill + persona en beantwoordt een administratie-vraag of documenteert OFFLINE-probe
- [ ] Geen tweede poller op hetzelfde bot-token (OpenClaw alleen als die nog pollen)
- [ ] Approvals/boekingen via Motor UI-deeplinks
- [ ] Geen Motor-sessietoken of side-effect-credential in QwenPaw
- [ ] `00-HUIDIGE-STAAT.md` bijgewerkt
