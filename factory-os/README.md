# factory-os

Map voor **Factory OS**: klanten, kennisbank, en **systeem**-artefacten (n8n-exports).

## Start hier (documentatie)

Alle runbooks en volgorde: **[`docs/FACTORY_OS_INDEX.md`](../docs/FACTORY_OS_INDEX.md)**.

## Indeling

| Map | Inhoud |
|-----|--------|
| `klanten/<klant>/` | o.a. `kennisbank/` — per-klant assets |
| `systeem/n8n-workflows/` | Geëxporteerde n8n-workflows (JSON) — **bron** voor import |
| `systeem/cherry-studio/` | **Cherry Studio (Mac):** MCP **Memory + Fetch** (geen GitHub); NUC via Tailscale |

Geen secrets in deze map committen; keys blijven in **`AI_HQ/.env`**.
