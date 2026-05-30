# Complete cleanup sprint (Cursor)

De bron `CURSOR_COMPLETE_CLEANUP_SPRINT.md` stond niet in de repo; dit document vat **vijf parallelle werkstromen** samen en wat er is uitgevoerd / wat optioneel blijft.

## Workstream 1 — Dubbele logica in chat-stream

- **Doel:** minder duplicatie, één pad voor “assistant opslaan + memory + SSE done”.
- **Gedaan:** `persistAssistantAndEmitDone()` in `app/api/chat/stream/route.ts` (builder + n8n tak).
- **Niet gedaan (bewust):** `callFactoryN8n` / `callReviewN8n` in `lib/chat-n8n.ts` samenvoegen — grotere wijziging, aparte PR.

## Workstream 2 — Client chat-payload

- **Doel:** geen twee keer dezelfde JSON voor `/api/chat` en `/api/chat/stream`.
- **Gedaan:** `serializeChatBody()` in `lib/openclaw.ts`.

## Workstream 3 — Tooling (lint / types / verify)

- **Doel:** snellere feedback en expliciete ignores.
- **Gedaan:** `typecheck`, `lint:fix`, `verify` = lint + typecheck + build; ESLint `ignores` voor `.next`, `node_modules`, `out`, `coverage`; `@types/node` → `^22` (Node 22 engines).
- **Gedaan:** `.next/dev/types` uit `tsconfig.json` include gehaald — `tsc --noEmit` faalde op verouderde Next-validators naar verwijderde routes; productie-build blijft `.next/types` gebruiken.

## Workstream 4 — Debug-ruis

- **Bevinding:** amper `console.log` in `app/` / `components/`; enkele `console.warn` in `lib/builder-research.ts` en `lib/motor-memory.ts` zijn functioneel (foutpaden).
- **Actie:** geen wijziging (geen nutteloze logs verwijderd).

## Workstream 5 — TODO/FIXME / legacy

- **Bevinding:** geen echte `TODO`/`FIXME` tags in bron; backlog kan in `factory-os/docs/CURSOR_TODO.md` (zie `app/api/cursor-tasks`).
- **Actie:** geen code-wijziging.

## Optioneel later (simpeler / schoner, niet uitgevoerd)

- **Playwright** blijft in `dependencies` — wordt gebruikt door `lib/automation/playwright-browser.ts` op de server; pas naar `devDependencies` als die routes nooit in productie draaien.
- **Prettier** of `format`-script — alleen toevoegen als het team dat wil.
- **`clean` script** — `rm -rf .next` voor reproducerbare builds.

## Verificatie

```bash
cd /home/pietje/AI_HQ/ai-motor && npm install && npm run verify
```
