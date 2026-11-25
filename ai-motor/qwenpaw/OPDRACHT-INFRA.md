# Bericht aan infra — project QwenPaw ↔ bookkeeping

> Plak of stuur door. Canonieke brief: [`../docs/qwenpaw-infra-project.md`](../docs/qwenpaw-infra-project.md)

---

**Project:** QwenPaw kan Odoo-facturen lezen via de bookkeeping-bot.

**Probleem:** Agent `boka_operations` (Docker) krijgt OFFLINE op poort 8001 (loopback + Docker-host). Data zit in Odoo; de bot leest Odoo. Credentials blijven op de bot.

**Jij doet:**
1. Bookkeeping-bot vinden/starten (`curl http://127.0.0.1:8001/health`).
2. Private URL die **vanaf de QwenPaw-container** werkt (Tailscale — niet internet).
3. In QwenPaw Console: `BOOKKEEPING_BOT_URL=http://…:8001`.
4. Test: `motor_admin.py probe` en `odoo --year 2026 --quarter 3` niet OFFLINE.
5. Bewijs (curl + probe) terug naar Pietje.

**Niet:** Odoo-wachtwoord in QwenPaw, Motor-token, :8001 publiek, approve/boek vanuit QwenPaw.

Volledige checklist + rollback: `ai-motor/docs/qwenpaw-infra-project.md` (PR #14).
