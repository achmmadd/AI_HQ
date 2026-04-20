# Handoff — volgende AI / operator

## Dify API key (“niet geconfigureerd”)

Routes zoals **`POST /api/artifact/generate`** praten direct met Dify (`/v1/chat-messages`). Zonder key: **503** + uitleg in JSON.

**In `ai-motor/.env.local` zetten** (niet committen), minstens één van:

- `DIFY_API_KEY`
- `DIFY_CODE_INTERPRETER_API_KEY`
- `DIFY_SOCIAL_API_KEY`

Waarde: **App API key** in Dify → **API Access**.  
Optioneel: `DIFY_BASE_URL` (default `http://127.0.0.1:5001`).

Daarna: `cd ~/AI_HQ/ai-motor && npm run build && pm2 restart ai-motor --update-env`.

## Overige pointers

- Builder-handleiding: `factory-os/docs/EERSTE_APP_FUMERO_DASHBOARD.md`
- QA: `bash ~/AI_HQ/scripts/qa_grondig.sh`
- Builder API: sessie vereist; artifact-route: Dify-key vereist
- Kern: `ai-motor/lib/artifact-html.ts`, `ai-motor/app/api/artifact/generate/route.ts`
