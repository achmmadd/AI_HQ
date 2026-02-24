# The Handshake — Cloudflare Tunnel (Quick Tunnel of eigen domein)

**Quick Tunnel (geen domein nodig):** Start de stack met `docker compose --profile with-tunnel up -d` **zonder** `TUNNEL_TOKEN` in `.env`. Cloudflared start dan een Quick Tunnel naar `http://omega-mission-control:8501`. De **https://*.trycloudflare.com**-URL staat in de containerlogs; stuur in Telegram **/tunnel** — Jarvis (LinkScraper) leest de cloudflared-logs en stuurt je de link. Geen Cloudflare-domein nodig.

**Eigen domein:** Zet `TUNNEL_TOKEN` in `.env` en volg onderstaande stappen voor de Public Hostname in het Cloudflare Dashboard.

---

## Stap 1: Tunnel starten

- **Quick Tunnel (geen domein):** `docker compose --profile with-tunnel up -d` **zonder** `TUNNEL_TOKEN`. Stuur daarna in Telegram **/tunnel** — Jarvis haalt de trycloudflare.com-URL uit de cloudflared-logs en stuurt die.
- **Eigen domein:** `TUNNEL_TOKEN` in `.env` zetten (Cloudflare Zero Trust → Tunnels → Create → Install connector). Daarna: `docker compose --profile with-tunnel up -d`.
- **Op de host (zonder Docker):** cloudflared installeren en `cloudflared tunnel run --token <TUNNEL_TOKEN>` of quick tunnel handmatig draaien.

---

## Stap 2: Public Hostname in Cloudflare

1. Ga naar **Cloudflare Zero Trust** (teams.cloudflare.com) → **Networks** → **Tunnels**.
2. Klik op je tunnel (de connector die met het token draait).
3. Open het tabblad **Public Hostname** (of **Routing**).
4. Klik **Add a public hostname** (of **Add hostname**).

Vul in:

| Veld | Waarde |
|------|--------|
| **Subdomain** | `hq` (of een andere subdomain; het volledige adres wordt dan bv. hq.jouwdomein.nl) |
| **Domain** | Je domein (bijv. `jouwdomein.nl`) dat in Cloudflare staat |
| **Service type** | **HTTP** |
| **URL** | Zie onder |

**URL** hangt af van hoe je draait:

- **Alles in Docker (compose met dashboard + cloudflared):**  
  **Hostname:** `omega-dashboard`  
  **Port:** `8501`  
  → In veel UI’s vul je in: `http://omega-dashboard:8501` of hostname `omega-dashboard`, port `8501`.

- **Cloudflared op de host, dashboard in Docker (poort 8501 op host):**  
  **URL:** `http://localhost:8501` of `http://127.0.0.1:8501`.

- **Alles op de host (geen Docker):**  
  **URL:** `http://localhost:8501` (Streamlit draait lokaal op 8501).

Kortom: **map je subdomain (bv. hq.jouwdomein.nl) naar de plek waar het Omega Command Center (poort 8501) bereikbaar is:** in Docker als `omega-dashboard:8501`, op de host als `localhost:8501`.

---

## Stap 3: Controleren

- Open in de browser: **https://hq.jouwdomein.nl** (of je gekozen hostname).
- Je zou het Omega Command Center moeten zien (Streamlit-dashboard).
- Geen poorten hoeven op de NUC/firewall open; verkeer loopt via Cloudflare.

---

## Mission Control / omega-mission-control

In sommige documentatie staat **omega-mission-control**. In deze repo heet de dashboard-container **omega-dashboard**. Gebruik dus:

- **Hostname (in Docker):** `omega-dashboard`  
- **Port:** `8501`  

Dus: **hq.jouwdomein.nl → http://omega-dashboard:8501**.
