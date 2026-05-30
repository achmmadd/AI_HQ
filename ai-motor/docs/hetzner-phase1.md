# Hetzner — Fase 1 (NUC + Dify)

Status-runbook voor **vandaag**: OpenClaw bijwerken, Hetzner klaarzetten, **Dify** als Docker-stack deployen, MotorsAI daarop aansluiten.

> **Naamgeving:** In Motor AI-chats heet dit soms **“Diffy”** (code-review backend). In repo en infra is het **Dify** (self-hosted LLM platform). `/code` gebruikt vandaag **lokale** diff-review (`CodeDiffReview` + `write_proposal`); een externe Dify-workflow is **Fase 2** (Sprint A2).

## Wat al op de NUC draait (baseline)

| Service | Poort | Check |
|---------|-------|--------|
| Dify (nginx) | 5001 | `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:5001/console/api/setup` → 200 |
| Motor AI (PM2) | 3040 | `GET /api/health` → `dependencies.dify.ok` |
| n8n | 5678 | idem health |
| Qdrant | 6333 | zie `hetzner-migration.md` fase Qdrant |

OpenClaw update (Node **≥ 22.12**):

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.2/bin:$PATH"
openclaw update   # 2026.4.15 → 2026.5.22 (incl. doctor + daemon restart)
```

## Blokker: Hetzner SSH

Op de NUC is **geen** `~/.ssh/config` en **geen** Hetzner-IP in documentatie. Wel aanwezig:

- `~/.ssh/motor2_ed25519` (+ `.pub`) — waarschijnlijk voor de nieuwe server
- `~/.ssh/oci_dify_ed25519` — oudere OCI/Dify-key

### Eenmalig van jou nodig

1. **Publiek IPv4** (of Tailscale-IP) van de Hetzner CX/CPX box  
2. **SSH-user** (bijv. `root` of `pietje`)  
3. **Key op server:** plak inhoud van `~/.ssh/motor2_ed25519.pub` in `~/.ssh/authorized_keys` op Hetzner  
4. **Poort/domain Dify** na deploy: bv. `5001` intern + Cloudflare Tunnel, of `https://dify.jouwdomein.nl`  
5. (Later) **Dify API keys** per app — in `ai-motor/.env.local` / PM2, **niet** in git  

### SSH-config voorbeeld (lokaal, niet committen met secrets)

Maak `~/.ssh/config`:

```
Host hetzner-motor
  HostName <HETZNER_IPV4>
  User root
  IdentityFile ~/.ssh/motor2_ed25519
  IdentitiesOnly yes
```

Test:

```bash
ssh hetzner-motor 'uname -a; free -h; df -h /'
```

## Fase 1 — vanaf NUC (als SSH werkt)

```bash
cd ~/AI_HQ/ai-motor
export HETZNER_SSH=hetzner-motor   # of root@<ip>
./scripts/hetzner-phase1-from-nuc.sh
```

Het script:

1. OS + RAM/disk check op Hetzner  
2. Installeert Docker als het ontbreekt  
3. Synct/rsync Dify `docker/` stack (of clone) en start `docker compose up -d`  
4. Print vervolgstappen voor MotorsAI `.env.local`

## MotorsAI koppelen (na Dify op Hetzner)

In `~/AI_HQ/ai-motor/.env.local` (voorbeeld — waarden invullen):

```
DIFY_BASE_URL=https://dify.jouwdomein.nl
DIFY_API_KEY=app-...
# optioneel per app:
# DIFY_CODE_INTERPRETER_API_KEY=app-...
```

Zorg dat **n8n** dezelfde base ziet (`FACTORY_OS_DIFY_API_BASE` in `~/AI_HQ/.env`).

Herstart:

```bash
cd ~/AI_HQ/ai-motor
npm run build
pm2 restart ecosystem.config.cjs --update-env
```

Verify:

```bash
curl -s http://127.0.0.1:3040/api/admin/integration-readiness | jq '.dify_builder_configured, .checklist'
curl -s https://motorsai.app/api/smoke-production | jq '.features.dify_builder_configured'
```

`/code` blijft werken via **local-executor** + OpenRouter/Anthropic; geen Dify-URL nodig voor basis-flow. Dify is nodig voor **chat builder / artifact HTML** en toekomstige **multi-file review via workflow** (Fase 2).

## Rollback

- Zet `DIFY_BASE_URL` terug naar `http://127.0.0.1:5001`  
- `pm2 restart ecosystem.config.cjs --update-env`  
- Houd NUC-Dify een week aan als fallback (zie `factory-os/docs/NUC_TRIM_EN_MOTOR_INSPIRATIE_OMEGA.md`)

## Fase 2-gereedheid

- [ ] Hetzner SSH + Dify HTTP 200 op nieuwe host  
- [ ] `integration-readiness` groen voor Dify keys  
- [ ] Sprint A2: dedupe proposals, reject-all, optioneel Dify workflow voor cross-file review  

Zie ook [`hetzner-migration.md`](hetzner-migration.md) voor Qdrant/Ollama/n8n volgorde.
