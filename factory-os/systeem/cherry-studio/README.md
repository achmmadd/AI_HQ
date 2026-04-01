# Cherry Studio — MCP (referentieconfig)

Deze map staat in **AI_HQ op de NUC/repo**; **Cherry Studio en `npx` draaien op je Mac**. Je kopieert de instellingen naar Cherry Studio of importeert waar de app dat ondersteunt.

- **`mcp-config.json`** — samenvatting van servers (schema kan per Cherry Studio-versie iets afwijken; zie **INSTALLATIE.md** voor handmatige invoer).
- **`INSTALLATIE.md`** — stap-voor-stap op de Mac.

## Servers (stdio, lokaal op Mac)

### GitHub MCP
Leest/schrijft o.a. de **AI_HQ**-repo op GitHub (geen lokale clone nodig voor veel operaties).

**Vereist:** `GITHUB_TOKEN` in de omgeving van Cherry Studio (of in de env-velden per server).  
Let op: `${GITHUB_TOKEN}` in JSON wordt **niet** automatisch overal ingevuld — zet de token in Cherry Studio onder **Env** of exporteer in de shell waarmee je Cherry start.

### Memory MCP
Persistent geheugen tussen sessies; data leeft **lokaal op de Mac** (niet op de NUC).

### Fetch MCP
Haalt URL’s op — handig om **Open WebUI / n8n / Dify** op de NUC te benaderen via **Tailscale-IP** (HTTP). Package: **`mcp-fetch-server`** (`npx -y mcp-fetch-server`). Het pakket `@modelcontextprotocol/server-fetch` staat **niet** op npm.

## NUC via Tailscale

Voer op de NUC uit: `tailscale ip -4` → gebruik `http://<DAT-IP>:<poort>`.

| Service     | Typische URL (pas poorten aan jouw setup aan) |
|------------|-----------------------------------------------|
| Open WebUI | `http://100.x.x.x:3000`                       |
| n8n        | `http://100.x.x.x:5678`                       |
| Dify       | vaak via nginx host-poort (bijv. `5001`, `5443`, of `80`) — niet overal poort 80 |

Zie ook `docs/TOEGANG_VANAF_ANDERE_LOCATIES.md` (indien aanwezig) voor jullie echte poorten.

## n8n als MCP

Een **officiële “n8n MCP”-stdio server** zit niet in dit bestand. Praktisch:

- **Fetch MCP:** `GET`/`POST` naar n8n-webhooks of REST (met API-key) via `http://<tailscale-ip>:5678/...`.
- Of later een **custom MCP** / community-package toevoegen als jullie die kiezen.

Meer: **INSTALLATIE.md**.
