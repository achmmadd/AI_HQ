# NUC-testconsole (kiosk) — spoor D

De NUC is in P0 **uitsluitend** een tailnet-browser/kiosk naar de
Hetzner-pilot-UI. Dit is bewust géén product-UI en géén nieuwe trust
boundary.

## Topologie

```text
NUC (browser, kiosk) ──tailnet──> Hetzner motor-pilot API (tailnet-IP:4400)
```

- De UI blijft same-origin door de Hetzner-pilotserver geleverd.
- De browser praat direct met de Hetzner tailnet-origin, zodat de
  WhoIs-login de echte clientnode (de NUC) ziet.
- De NUC draait **geen** reverse proxy, bewaart **geen** context/drafts/
  secrets en praat **niet** direct met de model- of storepoort.
- De NUC-node moet in `PILOT_ACL` op Hetzner staan (stabiele node-ID),
  anders krijgt ook deze browser 403.

## Gebruik

```sh
MOTOR_PILOT_URL="http://<HETZNER_TAILNET_IP>:4400/" ./motor-pilot-kiosk.sh
```

De launcher bevat alleen placeholders; de echte tailnet-waarden komen uit de
omgeving van de operator, nooit uit de repo.

## Expliciet buiten scope

- Lokaal hosten van de UI op de NUC (vereist een apart expliciet-origin- en
  identity-propagationontwerp — stop en escaleer als dat nodig blijkt).
- Wildcard-CORS (nooit).
- Een reverse proxy die alle gebruikers als de NUC-identiteit laat
  verschijnen (nooit).
