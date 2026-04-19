# Tailscale niet bereikbaar op hotspot — wat te doen

Op een **mobiele hotspot** (4G/5G) werkt Tailscale soms niet: providers blokkeren of beperken de poorten/protocol die Tailscale gebruikt.

---

## 1. Eerst controleren (op hotspot met je Mac)

**Tailscale-status:**
```bash
tailscale status
```
Staat de Mac op "Connected"? Zie je **openclaw-nuc** in de lijst?

**Ping naar de NUC:**
```bash
ping -c 3 100.93.43.111
```
Krijg je antwoord of "Request timeout"?

**SSH proberen met extra info:**
```bash
ssh -v pietje@100.93.43.111
```
(-v = verbose; onderaan zie je waar het stopt: timeout, refused, enz.)

---

## 2. Tailscale-relay inschakelen (vaak oplossing op hotspot)

Soms werkt alleen een **directe** verbinding niet, maar een verbinding **via Tailscale’s relay (DERP)** wel.

- Ga op je telefoon/tablet of Mac naar **https://login.tailscale.com/admin/settings**
- Of: Tailscale-app → … / Settings
- Zoek **"Use Tailscale DERP servers"** of **"Relay"** en zet dat **aan** als het uit stond.
- Soms heet het: **"Allow incoming connections via relay"** of in **Machine settings** per device "Use as exit node" / relay toestaan.

Sla op en probeer op de Mac (weer op hotspot) opnieuw:
```bash
ssh pietje@100.93.43.111
```

---

## 3. NUC controleren (thuis, via je normale netwerk)

Op de NUC (of via SSH thuis):

```bash
tailscale status
sudo systemctl status tailscaled
```
Tailscale moet daar "Connected" zijn. Zo niet: `sudo tailscale up` opnieuw draaien.

---

## 4. Als het op hotspot echt niet lukt

Sommige providers blokkeren Tailscale volledig op mobiele data. Dan heb je twee opties:

**A) Testen op ander netwerk**  
Bijvoorbeeld WiFi op werk of bij iemand anders. Werkt het daar wél, dan is het je hotspot-provider die blokkeert.

**B) Fallback: andere manier van toegang**  
- **ZeroTier** proberen (andere poorten/protocol, wordt soms wel doorgelaten).  
- Of een **VPS** als tussenstap: NUC maakt (thuis) een uitgaande SSH-tunnel naar de VPS; jij verbindt vanaf hotspot met de VPS en komt zo op de NUC. (Vereist wat meer setup.)

---

## Kort

1. Op hotspot: `tailscale status` en `ping 100.93.43.111`.  
2. In Tailscale-admin: relay/DERP aanzetten.  
3. Op NUC: `tailscale status` controleren.  
4. Blijft het falen op hotspot → waarschijnlijk blokkade bij je provider; test op ander WiFi-netwerk of overweeg ZeroTier/VPS.
