# Omega op de NUC — bedoeling en setup

## Bedoeling

**Omega** is de bot die de **NUC (en terminal/infrastructuur)** bestuurt. Jij praat in Telegram tegen Omega; Omega voert op de machine uit waar hij draait (scripts, status, taken, notities, toestemming voor herstarten, enz.).

Daarom hoort Omega **op de NUC** te draaien:

- Dan bestuurt Omega de NUC en de terminal daar (launch_factory, scripts, dashboard, heartbeat, engineer).
- Er draait maar één Omega met die token → geen Conflict.
- 24/7: NUC aan, Omega aan → je kunt altijd opdrachten geven.

## Aanbevolen setup

| Waar      | Wat draaien |
|-----------|-------------|
| **NUC**   | Omega (launch_factory: bridge, dashboard, heartbeat, engineer) |
| **Laptop**| Alleen Zwartehand als je die wilt (andere token), of niets; **niet** Omega |

- **Sync code naar NUC:** vanaf je laptop bv. `rsync -avz --exclude venv ... AI_HQ/ pietje@nuc:~/AI_HQ/`
- **Op de NUC:** `cd ~/AI_HQ && ./launch_factory.sh` (en eventueel `./scripts/launch_zwartehand.sh` als Zwartehand ook op de NUC moet).
- **Op de laptop:** geen `launch_factory.sh` voor Omega; anders Conflict (twee keer dezelfde token).

## Als je Omega tóch op de laptop test

Tijdelijk kan Omega op de laptop draaien om te testen. Zet dan **op de NUC** Omega uit (geen `launch_factory` of stop de bridge daar). Anders: Conflict.

Voor echt gebruik: Omega op de NUC, dan bestuurt hij de NUC/terminal zoals bedoeld.
