# Toegang tot de NUC vanaf andere locaties / IP's

Je wilt vanaf werk, vakantie of een andere plek in de terminal op de NUC werken (SSH). Hier de opties.

---

## 1. Tailscale (aanrader: eenvoudig en veilig)

**Idee:** Een klein VPN tussen je apparaten. NUC en laptop/telefoon krijgen een vast Tailscale-IP; je kunt overal `ssh pietje@100.x.x.x` doen.

**Op de NUC** (in een terminal waar je sudo kunt gebruiken):

```bash
# 1. Tailscale installeren (wachtwoord vragen mogelijk)
curl -fsSL https://tailscale.com/install.sh | sudo sh

# 2. Tailscale starten en koppelen aan je account
sudo tailscale up
```
Er verschijnt een **URL** (bijv. https://login.tailscale.com/a/...). Open die in je browser, log in (of maak een gratis account), en keur de NUC goed. Daarna is de NUC in je Tailscale-netwerk.

```bash
# 3. Tailscale-IP van de NUC opvragen
tailscale ip -4
```
Dat IP (bijv. 100.64.x.x) gebruik je vanaf andere locaties: `ssh pietje@<dat-IP>`.

**Op je laptop/andere machine:** Tailscale installeren (https://tailscale.com/download), inloggen met hetzelfde account. Daarna:
```bash
ssh pietje@<NUC-tailscale-IP>
```

**Voordelen:** Geen poorten openen op je router, werkt achter NAT/firewall, versleuteld. Gratis voor persoonlijk gebruik.

---

## 2. ZeroTier (alternatief voor Tailscale)

Zelfde idee: virtueel netwerk. Op NUC en laptop ZeroTier installeren, een netwerk aanmaken op zerotier.com, beide joinen. Dan `ssh pietje@<zerotier-ip-van-nuc>`.

---

## 3. Poort 22 doorsturen op je router (zonder VPN)

**Idee:** Router: poort 22 doorsturen naar het lokale IP van de NUC (bijv. 192.168.178.43). Vanaf buiten: `ssh pietje@<jouw-openbare-ip>` of `ssh pietje@mijnhuis.duckdns.org` als je dynamische DNS gebruikt.

**Veiligheid is belangrijk:**
- Alleen inloggen met SSH-sleutels (geen wachtwoord): `ssh-keygen` op laptop, `ssh-copy-id pietje@nuc`
- Optioneel: fail2ban op de NUC tegen brute force
- Overweeg een andere poort dan 22 (bijv. 2222) en die doorsturen om automatische scans te verminderen

---

## 4. Wat je dan doet (zelfde als nu)

Zodra je verbinding hebt (Tailscale, ZeroTier of poort 22):

```bash
ssh pietje@<NUC-IP>
cd ~/AI_HQ
# Wat je nu ook doet: logs bekijken, launch_factory, scripts, enz.
tail -f logs/telegram_bridge.log
./scripts/grote_controle_alles.sh
```

Omega en Zwartehand draaien al op de NUC; je beheert ze gewoon via SSH vanaf welke locatie dan ook.

---

## Samenvatting

| Methode        | Moeite | Veiligheid | Vanaf andere locatie |
|----------------|--------|------------|-----------------------|
| **Tailscale**  | Laag   | Hoog       | Ja                    |
| **ZeroTier**   | Laag   | Hoog       | Ja                    |
| **Poort 22**   | Medium | Alleen met sleutels + evt. fail2ban | Ja |

Aanrader: **Tailscale** op de NUC en op je laptop; daarna overal `ssh pietje@<nuc-tailscale-ip>`.
