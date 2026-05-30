# MotorsAI PC Bridge (Phase 2)

Doel: dezelfde **local executor**-operaties (`read_file`, `write_file`, `list_dir`, `run_command`) op de **ontwikkelaars-PC** uitvoeren, terwijl MotorsAI op de NUC blijft draaien.

## Protocol (stub)

1. Gebruiker start **MotorsAI Bridge** op de PC (Node of Python CLI).
2. Bridge haalt een **one-time token** op via MotorsAI UI (`/admin` → PC koppelen) of handmatig gegenereerd secret.
3. Bridge registreert zich bij de NUC:
   - `POST /api/local-bridge/register` met `{ "device_name": "...", "token": "..." }`
   - Antwoord: `{ "bridge_id": "...", "poll_url": "..." }` (nog niet geïmplementeerd — zie stub-route)
4. NUC wachtrij stuurt taken; bridge voert uit binnen `LOCAL_WORKSPACE_ROOT` op de PC en post resultaat terug.

## Beveiliging (gepland)

- Alleen paden onder een door de gebruiker gekozen projectmap.
- Commando-allowlist identiek aan NUC executor.
- Optionele goedkeuring per taak in de bridge-UI.
- TLS via bestaande tunnel (Cloudflare / Tailscale); geen executor op `0.0.0.0`.

## Status

| Onderdeel | Status |
|-----------|--------|
| NUC executor (`127.0.0.1:8790`) | **MVP live** — zie `LOCAL_EXECUTOR.md` |
| `POST /api/local-bridge/register` | **Stub** — retourneert protocol + `phase: 2` |
| WebSocket / polling worker | Niet gebouwd |

## Env (toekomst)

| Variabele | Beschrijving |
|-----------|--------------|
| `LOCAL_BRIDGE_ENABLED` | `true` op NUC wanneer PC-bridge actief is |
| `LOCAL_BRIDGE_POLL_INTERVAL_MS` | Poll-interval voor bridge clients |
