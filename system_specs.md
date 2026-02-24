# Systeem specificaties

*Laatst bijgewerkt: 2026-02-19*

## CPU

| Eigenschap | Waarde |
|------------|--------|
| Model | Intel(R) Core(TM) i5-5250U @ 1.60GHz |
| Fysieke cores | 2 |
| Logische cores (threads) | 4 |
| Architectuur | x86_64 |

## RAM

| Eigenschap | Waarde |
|------------|--------|
| Geïnstalleerd | 2× 8 GB DDR3-1600 SODIMM (16 GB totaal) |
| Max. capaciteit moederbord | 16 GB |
| *Huidige detectie door OS* | *Controleer met `free -h`; bij 8 GB: tweede module controleren of herstarten.* |
| Richtlijn voor OpenClaw | Containers krijgen voldoende RAM; agent-workers hebben een veilige limiet zodat de NUC stabiel blijft. |

## Schijf

| Eigenschap | Waarde |
|------------|--------|
| Root-partitie (/) | /dev/sda2 |
| Totaal | ~218 GB |
| Gebruikt | ~57% |
| Vrij | ~90 GB |

## OpenClaw – resourcebeleid

- **omega-bridge** en **omega-mission-control**: geen vaste limiet, zodat Telegram en het dashboard altijd voldoende resources krijgen.
- **agent-workers**: limiet op CPU en geheugen zodat ze de NUC niet overbelasten; binnen die limiet krijgen ze zoveel mogelijk kracht.
- **restart: always**: alle containers starten na crash of reboot automatisch op.

---

*Bron: dmidecode, lshw, /proc/cpuinfo, free, df.*
