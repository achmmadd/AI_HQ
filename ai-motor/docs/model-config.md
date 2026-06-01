# Model Config (MotorsAI — Claude-vervanger)

Doel: **normale chat** is je dagelijkse werkpaard (OpenClaw + geheugen + tools). **Agent-modus** alleen voor browser/computer-use.

## Defaults (ingebouwd)

| Variabele | Default | Rol |
|-----------|---------|-----|
| `CHAT_MODEL` | `deepseek/deepseek-v4-pro` | Dagelijkse chat |
| `CHAT_RESEARCH_MODEL` | `perplexity/sonar-pro` | “Zoek op…” — live web in één call |
| `MOTORS_CHAT_USE_OPENCLAW` | `auto` | OpenClaw als gateway draait |
| `MOTORS_CHAT_FAST_PATH` | `0` | Geen bypass naar zwakke flash-route |
| `MOTORS_CHAT_RICH_CONTEXT` | `1` | Qdrant + kennisbank in preamble |
| `MOTORS_CHAT_OPENROUTER_FALLBACK` | `1` | Als Claw faalt → OpenRouter v4-pro |

Kopieer `.env.recommended` naar `.env.local` en vul `OPENROUTER_API_KEY` in.

Max live pagina's: `SCRAPE_PROVIDER=auto` (default) — Jina als `JINA_API_KEY` gezet, anders native fetch. Zie [docs/platform/url-reader.md](platform/url-reader.md).

## OpenClaw primary model

```bash
openclaw config set agents.defaults.model.primary "openrouter/deepseek/deepseek-v4-pro"
systemctl --user restart openclaw-gateway.service
```

Zwaar (coding marathon): `openrouter/moonshotai/kimi-k2.6`

## Flow normale chat

1. Lokale actie? → NUC executor (`lees bestand`, `run npm …`)
2. Web-intent? → **Perplexity Sonar** via OpenRouter
3. Anders → **OpenClaw** (tools, geheugen)
4. Claw faalt? → **DeepSeek V4 Pro** via OpenRouter
5. Laatste redmiddel → n8n Factory OS

## Agent-modus

Alleen voor **browser** (n8n / computer-use). Niet nodig voor slimme chat.

## Deploy

```bash
cd AI_HQ/ai-motor && nvm use && npm run build && pm2 restart ai-motor --update-env
```
