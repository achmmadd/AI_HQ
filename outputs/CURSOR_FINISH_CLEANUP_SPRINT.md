# Cursor — finish cleanup sprint

**Locatie:** deze file stond niet in de repo; gegenereerd naar `AI_HQ/outputs/CURSOR_FINISH_CLEANUP_SPRINT.md` zoals gevraagd.

## Status vs. 5 streams

| Stream | Scope (origineel) | Uitgevoerd in deze sessie |
|--------|-------------------|---------------------------|
| **A** | Error handling (4–6 u) | Centrale helpers: `lib/error-payload.ts`, `lib/http-json-response.ts`, `lib/client-fetch-errors.ts`, `lib/fetch-json-client.ts`; `useChat` history via `fetchJsonChecked`; `openclaw` deelt netwerk- en JSON-fouten (`failedResponseToError`); chat-stream `invalid_json_body` / gestandaardiseerde 400-responses; `/api/conversations` gebruikt `jsonOk` + `jsonCatchError`. **Resterend:** andere routes geleidelijk naar dezelfde patronen migreren; deploy-preflight in UI kan nog `fetchJsonChecked` gebruiken. |
| **B** | Component refactor (12–16 u) | **Eerste snede:** `chat-panel-constants.ts`, `chat-panel-skeleton.tsx`, `chat-panel` opgesplitst voor leesbaarheid. **Resterend:** verdere splitsing (`useConversations`, message list, composer) kan in vervolgstappen. |
| **C** | Mobile fixes (4–6 u) | `chat-workspace`: `100dvh` + safe-area op narrow / betere viewport; artifact overlay `touch-manipulation`, `min-h/min-w` voor knoppen op mobiel, deploy-dialog bottom-sheet-achtige layout + safe inset. **Resterend:** device-test op iOS Safari; invoerveld keyboards kunnen nog finetuning gebruiken. |
| **D** | Tests + docs (12–16 u) | `npm run test` (`tsx --test`): `lib/error-payload.test.ts`, `lib/fetch-json-client.test.ts`; `verify` inclusief tests. README-link toevoegen is optioneel. **Resterend:** E2E/playwright waar het de moeite loont; API route tests behind next. |
| **E** | Performance cleanup (6–8 u) | `ChatMarkdown` laadt nu **dynamic** (`next/dynamic`, `ssr: false`) om `react-markdown` uit de initiële chat-bundle te houden. **Resterend:** bundle-analyse, `recharts`/zware pagina’s lazy, server-side caching waar passend. |

## Commando’s

```bash
cd /home/pietje/AI_HQ/ai-motor
npm run test
npm run verify
```

## Realistische scope

De oorspronkelijke **40–50 u** inschatting is niet in één commit af te ronden; bovenstaande levert **breed gedragen verbeteringen** met lage regressierisico. Prioriteit voor vervolg: route-by-route `jsonHttpError`, grotere UI-splitsingen, echte mobiele regressietest op hardware.
