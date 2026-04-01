# Cherry Studio MCP — Installatie op Mac

## Vereisten

- **Node.js** op de Mac: `which npx && node --version` — zo niet: `brew install node`
- **Cherry Studio** geïnstalleerd
- **Tailscale** aan op Mac én NUC
- **NUC Tailscale IPv4:** op de NUC: `tailscale ip -4` (meestal `100.x.x.x`)

## Stap 1 — GitHub MCP

Cherry Studio → **Settings** → **MCP Servers** → **+ Add**

| Veld    | Waarde |
|---------|--------|
| Naam    | Factory OS — GitHub |
| Type    | stdio |
| Command | `npx` |
| Args    | `-y` en `@modelcontextprotocol/server-github` (twee args) |
| Env     | `GITHUB_TOKEN` = jouw fine-grained of classic token (minimaal repo-scope voor AI_HQ) |

**Save** → **Test Connection**

> Token **niet** in chat plakken; in Cherry UI of in `~/.zshrc` + herstart app alleen als je weet wat je doet.

## Stap 2 — Memory MCP

| Veld    | Waarde |
|---------|--------|
| Naam    | Factory OS — Geheugen |
| Type    | stdio |
| Command | `npx` |
| Args    | `-y` en `@modelcontextprotocol/server-memory` |

**Save** → **Test Connection**

## Stap 3 — Fetch MCP

| Veld    | Waarde |
|---------|--------|
| Naam    | Factory OS — Web Fetch |
| Type    | stdio |
| Command | `npx` |
| Args    | `-y` en `mcp-fetch-server` |

**Save** → **Test Connection**

## Stap 4 — NUC-services benaderen

Cherry Studio roept **Fetch** aan; jij (of het model) geeft een **volledige URL**:

```text
http://<NUC-TAILSCALE-IP>:3000
http://<NUC-TAILSCALE-IP>:5678
```

Dify hangt bij jullie vaak achter **nginx** op een **host-poort** (bijv. 5001) — niet blind `:80` aannemen. Test in de browser eerst.

**n8n-webhook (Factory OS):**

```bash
curl -sS -X POST "http://<NUC-TAILSCALE-IP>:5678/webhook/factory-os" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test","klant":"fumero"}'
```

Vanuit een gesprek: vraag het model om die URL via **fetch** te gebruiken (als Cherry het tool-gebruik doorgeeft).

## Stap 5 — Sneltest in Terminal (Mac)

```bash
# GitHub (Ctrl+C om te stoppen)
GITHUB_TOKEN="ghp_..." npx -y @modelcontextprotocol/server-github

npx -y @modelcontextprotocol/server-memory

npx -y mcp-fetch-server
```

Geen stacktrace bij start = meestal OK. Regels als `GitHub MCP Server running on stdio` / `Knowledge Graph MCP Server running on stdio` zijn goed. **Eerste keer** kan `npx` even **downloaden** (30–60 s) — geduld.

**GitHub-package:** npm kan **deprecated** tonen; de server start vaak nog wel. Later vervanger volgen als MCP/GitHub dat aangeeft.

## Repo-sync

```bash
cd ~/AI_HQ   # of waar je de repo clone’t
git pull
```

Config staat onder `factory-os/systeem/cherry-studio/`.

## Klaar als

- [ ] `mcp-config.json` / INSTALLATIE gevolgd in Cherry Studio  
- [ ] GitHub + Memory + Fetch **Test Connection** OK  
- [ ] Via Fetch (of browser) NUC op Tailscale-IP bereikbaar  

**Volgende stap (los van MCP):** Dify `@research_analyst` verder uitbouwen (tools, prompt, template).
