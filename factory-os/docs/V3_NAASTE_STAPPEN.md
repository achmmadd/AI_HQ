# Factory OS V3 — status na automatische stappen

**Uitgevoerd (Cursor / NUC):**

- **Node 22** via **nvm** (`~/.nvm`, default `v22.22.2`). OpenClaw vereist dit; gebruik in elke shell:  
  `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 22`  
  daarna: `openclaw --version` → werkt (bijv. `OpenClaw 2026.4.15`).
- **OpenClaw** opnieuw **globaal geïnstalleerd** onder Node 22 (`npm install -g openclaw@latest`).  
  `openclaw daemon restart` — gateway kan apart met `openclaw gateway` / systemd (zie CLI-output).
- **Qdrant `factory_os`**: collection **768-dim** (Ollama `nomic-embed-text`), **9 punten** ingeladen uit `factory-os/klanten/fumero/kennisbank/*.md`.
- **Ingest-script:** `~/AI_HQ/scripts/qdrant_ingest_kennisbank.py` (herhaal na nieuwe markdown).
- **`.env`:** `EMBEDDING_DIMENSION=768` (matcht Ollama-ingest; Dify kan eigen embed-dim hebben voor andere ketens).

**Nog handmatig (geen secrets beschikbaar in repo):**

| Item | Actie |
|------|--------|
| **`N8N_API_KEY`** | n8n → Settings → API → key aanmaken → `~/AI_HQ/.env` → `mcp.json` opnieuw genereren (`factory_os_v3_finalize.sh`) of handmatig invullen. |
| **Telegram** | `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` in `.env`. |
| **`git push`** | SSH-key voor `git@github.com` op deze user (`ssh-add`, `~/.ssh/config`). Nu: `Permission denied (publickey)`. |
| **`.npmrc` prefix** | nvm waarschuwt over `prefix` in `~/.npmrc`. Bij problemen: `nvm use --delete-prefix v22.22.2` of prefix-regel aanpassen. |

**Snel testen Qdrant:**

```bash
curl -s http://localhost:6333/collections/factory_os | python3 -c "import sys,json;print(json.load(sys.stdin)['result']['points_count'])"
```

**Opnieuw indexeren:**

```bash
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 22
python3 ~/AI_HQ/scripts/qdrant_ingest_kennisbank.py
```
