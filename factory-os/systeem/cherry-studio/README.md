# Cherry Studio — MCP (referentieconfig)

Deze map staat in **AI_HQ op de NUC/repo**; **Cherry Studio en `npx` draaien op je Mac**. Je kopieert de instellingen naar Cherry Studio of importeert waar de app dat ondersteunt.

**GitHub MCP gebruiken we niet** (geen token/push nodig voor deze setup). Code sync bijv. via **rsync**, **USB**, of later alsnog git met andere hosting.

- **`mcp-config.json`** — alleen **Memory** + **Fetch** (schema kan per Cherry Studio-versie iets afwijken; zie **INSTALLATIE.md**).
- **`INSTALLATIE.md`** — stap-voor-stap op de Mac.

## Servers (stdio, lokaal op Mac)

### Memory MCP
Persistent geheugen tussen sessies; data leeft **lokaal op de Mac** (niet op de NUC).

### Fetch MCP
Haalt URL’s op — handig om **Open WebUI / n8n / Dify** op de NUC te benaderen via **Tailscale-IP** (HTTP). Package: **`mcp-fetch-server`** (`npx -y mcp-fetch-server`).

## NUC via Tailscale

Voer op de NUC uit: `tailscale ip -4` → gebruik `http://<DAT-IP>:<poort>`.

| Service     | Typische URL (pas poorten aan jouw setup aan) |
|------------|-----------------------------------------------|
| Open WebUI | `http://100.x.x.x:3000`                       |
| n8n        | `http://100.x.x.x:5678`                       |
| Dify       | vaak via nginx host-poort (bijv. `5001`, `5443`, of `80`) |

Zie ook `docs/TOEGANG_VANAF_ANDERE_LOCATIES.md` (indien aanwezig).

## n8n als MCP

Geen aparte n8n-MCP in deze config — gebruik **Fetch** naar webhooks/REST op poort **5678**.

Meer: **INSTALLATIE.md**.
