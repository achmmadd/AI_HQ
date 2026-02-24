# AI-Holding Evomap

Realtime visueel dashboard voor het multi-agent systeem. Draait op resource-beperkte Intel NUC via Docker Compose.

## Stack

- **Backend:** FastAPI, SQLite (WAL), WebSockets
- **Frontend:** Next.js, React Flow
- **AI:** Gemini Pro Interactions API + MCP

## Starten

```bash
cd evomap
docker compose up -d
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- WebSocket: ws://localhost:8000/ws/evomap

**Externe toegang (NUC/1Panel):** Als je de frontend via een andere hostnaam bereikt (bijv. `http://nuc-ip:3000`), moet bij **build-time** `NEXT_PUBLIC_WS_URL` kloppen (bijv. `ws://nuc-ip:8000`), anders kan de React Flow geen verbinding met de WebSocket maken. Zet dit in `docker-compose.yml` onder `evomap-frontend.environment` of in een build-arg en herbouw de frontend-image.

## Vereisten

- `.env` in AI_HQ root met `GOOGLE_API_KEY` (voor Gemini)
- 1Panel: volumes `evomap_data` en `evomap_logs` zijn persistent voor back-ups.

### Omega / seed vanaf een andere machine (tunnel of NUC-IP)

De Evomap-backend luistert op **poort 8000**. De bestaande Cloudflare-tunnel (mission_control) gaat naar het **Streamlit-dashboard (8501)**; voor Evomap heb je dus ofwel het **NUC-IP** ofwel een **aparte tunnel naar 8000**.

Zet in je **.env** (AI_HQ root) één van deze regels (zonder slash aan het eind):

```bash
# Optie A:zelfde netwerk — NUC-IP + poort 8000
EVOMAP_API_URL=http://192.168.1.XX:8000

# Optie B: aparte tunnel naar Evomap (bijv. tweede cloudflared: --url http://evomap-backend:8000)
EVOMAP_API_URL=https://evomap-xxxxx.trycloudflare.com
```

Het seed-script leest `EVOMAP_API_URL` uit .env; je hoeft niets te exporteren. Daarna: `python3 scripts/seed_evomap_nodes.py`. Omega gebruikt dezelfde variabele voor `update_evomap_state`. Voor expliciete host-back-up van de database kun je een bind mount gebruiken, bijv. `./data:/data` voor de backend (en dan `DATABASE_PATH=/data/evomap.db`).

## MCP (Model Context Protocol)

Gemini fungeert als universele router: externe tools (GitHub, Gitee, etc.) worden via MCP-servers aangeroepen. Evomap heeft **geen losse OAuth-flows**; API-keys en OAuth worden door de MCP-servers zelf afgehandeld (bijv. via env in de server-process).

### MCP_SERVERS

Optioneel in `.env`:

- **Formaat:** `naam:command:args` per server, meerdere servers gescheiden door `;`
- **Voorbeeld:** `github:npx:--yes:@modelcontextprotocol/server-github` (een server “github” die met `npx @modelcontextprotocol/server-github` start)
- Tools worden aan Gemini doorgegeven als `naam_toolnaam` (bijv. `github_search_repos`). Bij een tool-call roept de backend de juiste MCP-server aan en stuurt het resultaat terug naar Gemini.
