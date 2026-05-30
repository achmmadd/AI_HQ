# MotorsAI VS Code extension

## Install locally

```bash
cd motors-vscode
code --install-extension .
```

## Setup

1. Command palette: **MotorsAI: Set API Token** (cookie `motorsai_token` from browser after login).
2. Settings: `motorsai.baseUrl`, `motorsai.klant`, optional `motorsai.workspace`.
3. **MotorsAI: Open Chat** — streams from `/api/chat/stream`.

## Laptop bridge (Sprint D)

| Command | Action |
|---------|--------|
| **Motors: Start PC Bridge** | Spawns `motors-pc-bridge register` + `poll` in a terminal, or shows CLI docs |
| **Motors: Open Code Workspace** | Opens `/code` in browser for current klant/workspace |
| **Motors: Send Selection to Code Agent** | Posts editor selection to `/api/code/agent` with selection context |

Bridge CLI (if not auto-found):

```bash
cd ~/AI_HQ/tools/motors-pc-bridge
node index.js register --url https://motorsai.app --workspace .
node index.js poll
```

Manage bridges: https://motorsai.app/cowork?tab=bridge

## Package (optional)

```bash
npm install -g @vscode/vsce
vsce package
```
