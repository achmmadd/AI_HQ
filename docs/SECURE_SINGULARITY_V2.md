# Omega Global: Secure Singularity V2

Wereldwijd bereikbaar via Cloudflare Tunnel, 1Panel API, Lockdown en Auto-Repair.

---

## Wat er is toegevoegd

- **Dashboard:** BU-tabs (marketing, app_studio, finance), real-time 1Panel-metrics, System Heartbeat-graph (24u), Emergency Lockdown-knop.
- **Telegram:** `/lockdown` (toggle) — zet lockdown-flag; opheffen kan via dashboard of nogmaals `/lockdown`.
- **Docker Compose:** `cloudflared` service (profile `with-tunnel`); start met `docker compose --profile with-tunnel up -d`.
- **Engineer:** Bij uitval Omega-bridge: 1Panel API container restart + melding naar Telegram. **Lockdown:** kijkt continu naar `data/lockdown.flag`; als die er is → stopt de `omega-cloudflared` container en stuurt: "🚨 LOCKDOWN GEACTIVEERD: Alle externe toegang tot de NUC is fysiek verbroken."
- **Resource Warden:** Elke 60s CPU-temp en load via 1Panel; bij >80°C of >90% load → Telegram-melding + pause van niet-kritieke BU-containers (bu_marketing, bu_app_studio); bij dalen → unpause.
- **omega_1panel_bridge:** `get_host_metrics()`, `container_pause`/`container_unpause`, `container_logs(naam, tail)`.
- **Dashboard:** Dynamisch sidebar-menu met `streamlit-antd-components` (sac.menu); BU's komen automatisch uit `/holding/`.
- **The Handshake:** Zie **docs/HANDSHAKE.md** voor exacte stappen: Public Hostname in Cloudflare (bijv. hq.jouwdomein.nl → http://omega-dashboard:8501).
- **.env.example:** `TUNNEL_TOKEN`, `ALLOWED_IPS`; 1Panel = `ONEPANEL_BASE_URL` / `ONEPANEL_API_KEY`.

---

## Cloudflare Tunnel (global access)

1. **Cloudflare Zero Trust** → Tunnels → Create tunnel → kies "Cloudflared" → kopieer het **token**.
2. In `.env`: `TUNNEL_TOKEN=<token>`.
3. Start stack mét tunnel: `docker compose --profile with-tunnel up -d`.
4. In Cloudflare: **Public Hostname** toevoegen. **Exacte stappen:** zie **docs/HANDSHAKE.md** (bijv. hq.jouwdomein.nl → HTTP → omega-dashboard:8501).

Geen poorten openen op de firewall; verkeer loopt via Cloudflare.

---

## IP-Header Trust (X-Forwarded-For)

Als je in 1Panel een **IP-allowlist** gebruikt en het verkeer komt via Cloudflare:

- Vertrouw **CF-Connecting-IP** of **X-Forwarded-For** voor het echte client-IP.
- In Nginx (of 1Panel reverse proxy): `set_real_ip_from` Cloudflare ranges en `real_ip_header CF-Connecting-IP;` (of `X-Forwarded-For`).
- Dan blijft de allowlist correct voor verkeer via de tunnel.

---

## Lockdown

- **Dashboard:** rode knop "EMERGENCY LOCKDOWN" in de sidebar → schrijft `data/lockdown.flag`.
- **Telegram:** `/lockdown` → zet flag; nogmaals `/lockdown` → flag weg (opheffen).
- **Automatisch:** De Engineer-daemon kijkt elke 30s naar `data/lockdown.flag`. Als de vlag er is, stopt hij de `omega-cloudflared` container en stuurt een bevestiging naar Telegram. Werkt wanneer Engineer op de host draait (launch_factory.sh); in Docker moet de Docker-socket gemount zijn.

---

## Engineer Auto-Repair

- Elke 5 min: check of Omega Telegram-bridge nog draait.
- Zo niet: roept `omega_1panel_bridge.container_restart("omega-telegram-bridge")` aan en stuurt een melding naar Telegram.
- Vereist: `TELEGRAM_CHAT_ID` in `.env`.

---

## Heartbeat-graph

- `heartbeat.py` schrijft elke minuut een punt naar `data/heartbeat_history.json`.
- Dashboard toont de **System Heartbeat**-graph (laatste 24 uur). Zorg dat de heartbeat-daemon draait.

---

## Resource Warden (System Caretaker)

- **resource_warden.py** draait elke 60s; haalt CPU-temp en load op via 1Panel (fallback: /proc/loadavg, /sys/class/thermal). Bij >80°C of >90% load: Telegram-melding + pause van bu_marketing en bu_app_studio; bij dalen: unpause. Start via launch_factory.sh. Zie ook **docs/HANDSHAKE.md** voor Cloudflare Public Hostname.

---

## Resource Warden (System Caretaker)

- **resource_warden.py** draait elke 60 seconden, haalt CPU-temperatuur en load op via 1Panel API (plus fallback `/proc/loadavg` en `/sys/class/thermal`).
- **Drempels:** >80°C of >90% load → Telegram: "Meneer, de NUC wordt te heet. Ik pauzeer de niet-kritieke Business Units." Daarna: `container_pause` op **bu_marketing** en **bu_app_studio** (via 1Panel API). Finance blijft draaien.
- Bij dalende waarden: `container_unpause` op die BU's en eventueel bevestiging via Telegram.
- Start via `launch_factory.sh` of handmatig: `python3 resource_warden.py`. Log: `logs/resource_warden.log`.
