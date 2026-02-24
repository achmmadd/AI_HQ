# Cursor-tips voor Omega AI-HQ

Korte tips zodat je sneller en beter met Cursor werkt in dit project.

## Snel naar bestanden

- **Cmd/Ctrl + P** → typ bestandsnaam (bijv. `ai_chat`) om een bestand te openen.
- **@ in de chat** → `@ai_tools.py` of `@docs/WAT_TE_DOEN.md` om dat bestand in de context te geven.

## Terminal

- **Terminal openen:** Cmd/Ctrl + `` ` `` of menu Terminal → New Terminal.
- Als je **op de NUC** werkt (Cursor via SSH): de terminal draait op de NUC. Rsync moet je dan **op je Mac** doen (andere terminal of andere machine).
- **Sync naar NUC:** altijd vanuit de **AI_HQ-map** op je Mac: `cd ~/AI_HQ` (of waar AI_HQ staat) en dan het rsync-commando uit `docs/WAT_TE_DOEN.md`.

## Chat met de AI

- Wees concreet: “pas ai_tools aan zodat …” of “voeg een script toe dat …”.
- Verwijs naar bestanden: “in telegram_bridge.py, regel 90” of “@launch_factory.sh”.
- Voor grote taken: vraag om een stappenplan of “grote naloop”.

## Regels van het project

- Cursor gebruikt **.cursor/rules/** voor dit project (bijv. Omega op NUC, sync, twee bots). Die regels worden automatisch meegenomen.
- **.cursorignore** zorgt dat venv, logs en .env niet geïndexeerd worden — sneller en veiliger.

## Handige sneltoetsen (standaard)

- **Cmd/Ctrl + S** — opslaan.
- **Cmd/Ctrl + Shift + F** — zoeken in alle bestanden.
- **Cmd/Ctrl + /** — regel(s) als comment zetten/ontcommenten.

## Foutmeldingen

- Klik op een fout in de editor of in het Problemen-paneel om naar de juiste regel te gaan.
- Bij import- of modulefouten: controleer of je in de juiste map werkt en of `venv` geactiveerd is (`source venv/bin/activate` of kiezen van de Python-interpreter uit venv).
