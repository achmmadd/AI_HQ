# Omega 1Panel: Singularity — afronding & 1Panel-instellingen

Dit document beschrijft wat er is gebouwd voor de "Master Singularity" transitie en **welke 1Panel API-instellingen** je moet aanpassen om de verbinding te voltooien.

---

## Wat er is gebouwd

1. **omega_1panel_bridge.py** — Centrale bridge naar 1Panel API (poort 8089 of `ONEPANEL_BASE_URL`):
   - CPU/RAM van containers, herstart container, firewall (Vesting/WAF) waar de API het ondersteunt.

2. **docker-compose.singularity.yml** — Stack:
   - **omega_core**: Telegram Bridge + Engineer in één container.
   - **omega_dashboard**: Streamlit (1Panel-stijl).
   - **bu_marketing**, **bu_app_studio**, **bu_finance**: Geïsoleerde werkomgevingen (alpine + sleep, klaar voor uitbreiding).

3. **Persistentie** — Volumes `omega_data`, `omega_logs`, `omega_holding`. Om te koppelen aan 1Panel-hostpad:
   - In 1Panel: bij de Compose-app de volume `omega_data` binden aan `/opt/1panel/apps/omega-holding/data` op de host (of na deploy handmatig in 1Panel aanpassen).

4. **deploy_bu.sh** — Maakt BU-map, `data/`, en **profile.json** aan; tip voor 1Panel container-naam.

5. **1Panel Log-Watcher** — `scripts/onepanel_log_watcher.py`: scant logs op Error/Panic, stuurt actieplan naar Telegram (vereist `TELEGRAM_CHAT_ID`).

6. **Dashboard** — Server Health (data uit 1Panel), Terminal-widget (live logs), kaarten #1d1d1d, accent #1677ff.

7. **Telegram** — `/panel` (1Panel stats), `/restart <container>`, `/secure` (WAF).

8. **Secrets** — Alle API-keys in `.env`; containers gebruiken `env_file: .env` (read-only aanbevolen: mount .env als read-only of gebruik 1Panel secrets).

---

## 1Panel API-instellingen

**Gedaan:** Stap 1 (API + key) en 2 (eventueel IP-allowlist). De rest: zie hieronder.

### 1. API inschakelen en poort (gedaan)

- Ga in 1Panel naar **Instellingen (Settings)** → **Panel**.
- **API-toegang** inschakelen (aanvinken).
- Noteer de **API-sleutel** (of reset en kopieer).
- Standaard draait 1Panel op een poort (bijv. **8089** of **1234**). Zorg dat je de juiste **basis-URL** gebruikt, bijv. `http://<NUC-IP>:8089`.

### 2. IP-allowlist (als je de API alleen vanaf de NUC wilt toestaan)

- In 1Panel: **Instellingen** → **Beveiliging** of **Panel**.
- Als er een **IP-allowlist** of **Toegestane IP’s** is: voeg het IP toe van de machine waar Omega/Jarvis draait (bijv. het Tailscale-IP van de NUC of `127.0.0.1` als alles op dezelfde host draait).
- Zonder allowlist: API is bereikbaar voor iedereen op het netwerk (alleen doen in vertrouwd netwerk of achter VPN/Tailscale).

### 3. ONEPANEL_BASE_URL en API-key in Omega (de rest)

- **Interactief (meest eenvoudig):** Run `./scripts/install_1panel_bridge.sh` en vul wanneer het script vraagt de 1Panel-URL en API-key in. Daarna is .env.1panel klaar — je hoeft geen export te doen.
- **Zonder vragen (optioneel):** Alleen als je niet interactief wilt typen: gebruik export met je echte IP en key. Bijv. `export ONEPANEL_BASE_URL="http://192.168.178.43:8089" ONEPANEL_API_KEY="jouw_echte_key"; ./scripts/install_1panel_bridge.sh`
- **Veelgemaakte fout:** Gebruik niet letterlijk "jouw-1panel-ip" of "http://jouw-1panel-ip:8089" — dat is een placeholder. Vul het IP in van de machine waar 1Panel draait (bv. je NUC) en de API-key uit 1Panel → Instellingen → Panel.
- **Daarna:** `./scripts/singularity_rest.sh` controleert .env.1panel, test de API en toont de volgende stap (launch_factory of docker compose). launch_factory.sh laadt .env.1panel automatisch.

### 4. Swagger controleren voor exacte endpoints

- Open in de browser: `http://<1Panel-IP>:<poort>/1panel/swagger/index.html`.
- Controleer de exacte paden voor:
  - **Containers** (lijst, herstart): vaak `containers/search`, `containers/operate` of gelijkwaardig.
  - **Dashboard/host** (CPU, RAM, OS): vaak `dashboard/base/os`.
- Als een aanroep 404 geeft: pas in `omega_1panel_bridge.py` het path aan naar wat Swagger toont.

---

## Tailscale (1Panel alleen via Tailscale)

- Zorg dat de NUC in je **Tailnet** zit en een vast Tailscale-IP heeft.
- In 1Panel: **Instellingen** → **Panel** → wijzig **Listen-adres** naar het Tailscale-IP (of bind alleen op dat IP), of gebruik een **reverse proxy** (bijv. Caddy/Nginx) die alleen op het Tailscale-interface luistert.
- Firewall: blokkeer poort 8089 (of de 1Panel-poort) op het normale LAN; laat alleen Tailscale-verkeer toe.
- Omega/Jarvis gebruik je dan met `ONEPANEL_BASE_URL=http://<Tailscale-IP-NUC>:8089`.

---

## Encrypted secrets (kort)

- **.env** en **.env.1panel** nooit committen; staan in **.gitignore**.
- Containers: gebruik `env_file: .env`; voor extra beveiliging kun je het bestand op de host als read-only mounten, of 1Panel **Secrets** gebruiken en die als environment aan de Compose-services doorgeven (indien 1Panel dat ondersteunt).

---

## Snelle checklist

| Stap | Status | Actie |
|------|--------|--------|
| 1 | gedaan | 1Panel - Instellingen - Panel: API inschakelen, API-key kopiëren |
| 2 | gedaan | Eventueel: IP-allowlist voor Omega-host |
| 3 | jij | Eénmalig: ./scripts/install_1panel_bridge.sh (of met ONEPANEL_BASE_URL + ONEPANEL_API_KEY) |
| 4 | jij | ./scripts/singularity_rest.sh dan ./launch_factory.sh of docker compose -f docker-compose.singularity.yml up -d |
| 5 | optioneel | Swagger openen als API 404 geeft |
| 6 | optioneel | TELEGRAM_CHAT_ID in .env voor log-alerts |

Na deze stappen zijn de bridge, het dashboard (Server Health), Telegram-commando’s en de log-watcher klaar voor gebruik.
