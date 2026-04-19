# AI Motor

Persoonlijk command center voor Factory OS.

## Start

- `npm run dev` — development (poort 3040)
- `pm2 start ai-motor` — productie (na `npm run build`)

## Routes

- `/` — Dashboard
- `/chat` — OpenClaw chat
- `/afdelingen` — Agent overzicht
- `/agenda` — Kalender + todo
- `/appstore` — Skills marketplace
- `/kennisbank` — Qdrant viewer

## Config

Kopieer `.env.example` naar `.env.local` en pas aan.

## Bereikbaar via

Cloudflare Tunnel → `localhost:3040`
