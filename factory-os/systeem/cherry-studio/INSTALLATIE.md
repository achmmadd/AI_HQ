# Cherry Studio MCP — Installatie op Mac

**Zonder GitHub** — alleen Memory + Fetch; NUC via Tailscale-URL’s.

## Vereisten

- **Node.js** op de Mac: `which npx && node --version` — zo niet: `brew install node`
- **Cherry Studio** geïnstalleerd
- **Tailscale** aan op Mac én NUC
- **NUC Tailscale IPv4:** op de NUC: `tailscale ip -4` (meestal `100.x.x.x`)

## Stap 1 — Memory MCP

Cherry Studio → **Settings** → **MCP Servers** → **+ Add**

| Veld    | Waarde |
|---------|--------|
| Naam    | Factory OS — Geheugen |
| Type    | stdio |
| Command | `npx` |
| Args    | `-y` en `@modelcontextprotocol/server-memory` |

**Save** → **Test Connection**

## Stap 2 — Fetch MCP

| Veld    | Waarde |
|---------|--------|
| Naam    | Factory OS — Web Fetch |
| Type    | stdio |
| Command | `npx` |
| Args    | `-y` en `mcp-fetch-server` |

**Save** → **Test Connection**

## Stap 3 — NUC-services benaderen

Cherry Studio roept **Fetch** aan; jij (of het model) geeft een **volledige URL**:

```text
http://<NUC-TAILSCALE-IP>:3000
http://<NUC-TAILSCALE-IP>:5678
```

Dify hangt bij jullie vaak achter **nginx** op een **host-poort** (bijv. 5001) — test in de browser eerst.

**n8n-webhook (Factory OS):**

```bash
curl -sS -X POST "http://<NUC-TAILSCALE-IP>:5678/webhook/factory-os" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"test","klant":"fumero"}'
```

## Stap 4 — Sneltest in Terminal (Mac)

```bash
npx -y @modelcontextprotocol/server-memory
# Ctrl+C om te stoppen

npx -y mcp-fetch-server
```

Regel als `Knowledge Graph MCP Server running on stdio` is goed voor Memory. **Eerste keer** kan `npx` **30–60 s** downloaden.

## Config ophalen vanaf NUC

Zonder GitHub: bv. **rsync/scp** van `~/AI_HQ/factory-os/systeem/cherry-studio/` naar je Mac, of bestanden handmatig kopiëren.

## Klaar als

- [ ] Memory + Fetch **Test Connection** OK in Cherry Studio  
- [ ] Via Fetch (of browser) NUC op Tailscale-IP bereikbaar  

**Volgende stap (los van MCP):** Dify agents / Factory OS verder uitbouwen.
