# Runbook — QwenPaw-migratie: projectadministratie + Telegram

> **Eigenaar:** Pietje · **Datum:** 2026-09-08
> **Besluit:** [ADR-110](DECISIONS.md) · **Staat:** [00-HUIDIGE-STAAT](architecture-2.2/00-HUIDIGE-STAAT.md) · **Delta:** [doc 15 §41.10](architecture-2.2/15-review-panel.md)
> **Artefacten:** [`../qwenpaw/`](../qwenpaw/) (agent-snippet + skill `project-administratie`)

## Doel en scope

De eigenaar bedient de projectadministratie (bonnen/administratie per project, fumero/bokas) via Telegram op QwenPaw. QwenPaw draait op de **NUC** (kanaal-node volgens ADR-108).

Wat de skill **wel** doet (read-only, R0):

- status van de administratie-service (`pending_approvals`, `retry_queue`, disk);
- recent geboekte bonnen tonen;
- export-documenten per kwartaal tonen;
- deeplinks naar de Motor UI geven voor elke actie.

Wat **niet** verandert:

- Boeken, approven, editen en exporteren blijven in de Motor UI (ADR-109, AM-4). Telegram blijft notificatie + deeplink, geen inhoudelijke boekingen.
- Geen Motor-sessietoken en geen side-effect-credentials in de QwenPaw-context. De skill leest alleen via loopback uit de bookkeeping-bot (`127.0.0.1:8001`).
- QwenPaw is geen orchestrator en geen memorylaag voor Motor-data (ADR-105/107/108).
- Motor-notificaties via `lib/telegram.ts` (alleen `sendMessage`) blijven werken; versturen conflicteert niet met pollen.

## Opdracht aan QwenPaw

De plakklare opdracht staat in [`../qwenpaw/OPDRACHT.md`](../qwenpaw/OPDRACHT.md). Pietje plakt dat bestand **in zijn geheel** in de QwenPaw Console-chat of in de privé-Telegramchat. Dat is de opdracht; QwenPaw installeert daarna zelf skill + persona-bestanden en doet de rooktest.

Persona-bestanden (staan daarna in de workspace, worden het systeemprompt):

- [`../qwenpaw/workspaces/default/AGENTS.md`](../qwenpaw/workspaces/default/AGENTS.md)
- [`../qwenpaw/workspaces/default/SOUL.md`](../qwenpaw/workspaces/default/SOUL.md)
- [`../qwenpaw/workspaces/default/PROFILE.md`](../qwenpaw/workspaces/default/PROFILE.md)

## Voorwaarden

1. QwenPaw is geïnstalleerd op de NUC (`qwenpaw --version` werkt) en er is een workspace (default: `~/.qwenpaw/workspaces/default`).
2. Motor-app draait (`pm2 list` toont `ai-motor`, poort 3040) en de bookkeeping-bot draait (`curl -s http://127.0.0.1:8001/health`).
3. Toegang tot @BotFather in Telegram en het huidige bot-token.
4. Het eigen Telegram-user-id van de eigenaar (via bijv. @userinfobot) voor de allowlist.

## Stap 1 — Nulmeting

Voer de meetcommando's uit [00-HUIDIGE-STAAT](architecture-2.2/00-HUIDIGE-STAAT.md) (aanvulling 2026-09-08) uit en bewaar de output als bewijs. Leg vast: QwenPaw-versie, draaiende workspace(s), of OpenClaw-Telegram nog actief is.

## Stap 2 — Telegram-token roteren en verhuizen

Eén bot-token mag niet door twee pollers tegelijk worden gebruikt. Daarom eerst roteren, dan verhuizen:

1. In @BotFather: `/revoke` → kies de bot → nieuw token. Noteer het nieuwe token in de secrets-store (niet in git).
2. In @BotFather: `/setprivacy` → ENABLED en `/setjoingroups` → DISABLED.
3. Werk op de NUC de Motor-omgeving bij (`TELEGRAM_BOT_TOKEN` in de Motor `.env.local` en waar OpenClaw het token gebruikt) zodat notificaties het nieuwe token gebruiken.
4. Configureer het Telegram-kanaal in QwenPaw. Gebruik [`../qwenpaw/agent.json.example`](../qwenpaw/agent.json.example) als snippet en **merge** het in `~/.qwenpaw/workspaces/default/agent.json` (niet overschrijven). Vul `bot_token` en zet in `allow_from` alleen het Telegram-user-id van de eigenaar. Alternatief: Console → Control → Channels → Telegram.
5. Herlaad: bestand opslaan triggert reload; anders `qwenpaw app` herstarten.

## Stap 3 — OpenClaw-Telegram uitzetten

Zodra stap 2 live is (QwenPaw antwoordt in Telegram):

1. Verwijder/disable het Telegram-kanaal in de OpenClaw-config op de NUC.
2. `systemctl --user restart openclaw-gateway.service` en controleer dat er geen Telegram-poller meer draait.
3. Bewijs: één bericht naar de bot wordt door precies één harness beantwoord (QwenPaw).

## Stap 4 — Skill `project-administratie` installeren

```bash
# op de NUC, vanuit de repo-checkout (of laat QwenPaw dit doen via OPDRACHT.md):
REPO="${HOME}/AI_HQ/ai-motor/qwenpaw"
WS="${HOME}/.qwenpaw/workspaces/default"
mkdir -p "$WS/skills/project-administratie"
cp -R "$REPO/skills/project-administratie/." "$WS/skills/project-administratie/"
cp "$REPO/workspaces/default/AGENTS.md" "$WS/AGENTS.md"
cp "$REPO/workspaces/default/SOUL.md" "$WS/SOUL.md"
cp "$REPO/workspaces/default/PROFILE.md" "$WS/PROFILE.md"
qwenpaw skills enable project-administratie --agent-id default
qwenpaw skills list --status enabled --agent-id default
```

Handmatig geplaatste skills worden bij de eerstvolgende reconcile gedetecteerd als **disabled**; het `enable`-commando hierboven is dus verplicht. Optionele env-vars (alleen afwijken bij niet-standaard poorten): `BOOKKEEPING_BOT_URL` (default `http://127.0.0.1:8001`) en `MOTOR_UI_BASE` (default `https://motorsai.app`, gebruikt voor deeplinks).

## Stap 5 — Testen (bewijsplicht)

```bash
# direct, zonder QwenPaw:
python3 ~/.qwenpaw/workspaces/default/skills/project-administratie/scripts/motor_admin.py status
python3 ~/.qwenpaw/workspaces/default/skills/project-administratie/scripts/motor_admin.py recent
python3 ~/.qwenpaw/workspaces/default/skills/project-administratie/scripts/motor_admin.py documents --year 2026 --quarter 3
```

Verwacht: `status` toont `online` met `pending_approvals` en `retry_queue`; bij een uitgevallen bookkeeping-bot print het script `OFFLINE` met exitcode 2 (dat is het beoogde degradatiegedrag).

Daarna in Telegram aan de bot vragen: *"Wat staat er nog open in de administratie?"* — het antwoord moet live cijfers tonen en eindigen met een deeplink naar de Motor UI. Een approval- of boekverzoek in Telegram moet de bot weigeren met een deeplink naar de Motor UI.

## Stap 6 — Documentatie bijwerken

1. Vul de meetresultaten in bij de aanvulling van 2026-09-08 in [00-HUIDIGE-STAAT](architecture-2.2/00-HUIDIGE-STAAT.md).
2. Vink de acceptatiepunten in [ADR-110](DECISIONS.md) af met bewijs (commandoutput/screenshot).
3. Bij AM-4-uitvoering: neem QwenPaw + modelprovider op in het verwerkingsregister en de subverwerkerslijst.

## Rollback

1. In `agent.json`: `channels.telegram.enabled: false` (of token leegmaken) en QwenPaw herladen.
2. OpenClaw-Telegram weer aanzetten en `systemctl --user restart openclaw-gateway.service`.
3. Token opnieuw roteren via @BotFather; Motor `.env.local` bijwerken.
4. Skill disablen: `qwenpaw skills disable project-administratie --agent-id default`. De skill is read-only en laat geen state achter; er is niets in databases terug te zetten.

## Acceptatie (spiegelt ADR-110)

- [ ] QwenPaw op de NUC beantwoordt een administratie-vraag in Telegram met live data (output bewaard)
- [ ] Precies één actieve poller op het bot-token (OpenClaw-Telegram uit)
- [ ] Approvals/boekingen lopen aantoonbaar via Motor UI-deeplinks, niet in Telegram
- [ ] Geen Motor-sessietoken of side-effect-credential in QwenPaw-config of -omgeving
- [ ] `00-HUIDIGE-STAAT.md` bijgewerkt met de live metingen
