# Fumero Campaign Studio — Beta Protocol (Stap 8)

Tenant #1: **Fumero** op Motor AI generic platform.  
Doel: 2 beta-gebruikers uploaden packs naar Meta **zonder reject**; NPS ≥ 7.

---

## Gates vóór beta-start

| Gate | ID | Groen als |
|------|-----|-----------|
| Product fidelity | **R4** | SSIM ≥ 0,85 op 1:1 productregio; 4:5 warn-only als 1:1 pass |
| Safe zone | **R5** | Safe zone pass 1:1 + 4:5 |
| Async jobs | **M2** | Pack-job P95 < 10 min op :3040 |
| LLM strategy | **M4** | `strategy.source === "llm"` wanneer OpenRouter bereikbaar |

Alle unit + smoke tests groen (`npx tsx --test lib/photo-studio/campaign/*.test.ts`).

---

## 5 beta-stappen

### Stap 1 — Selectie (nl-NL)

- Kies **3 bevestigde producten** met productfoto (Brand Kit confirmed).
- Doelen: minstens 2× `verkoop`, 1× `bereik`.
- Noteer SKU + pack-id per run.

### Stap 2 — Generatie

- Volledige pack **met media** (FAL_KEY aanwezig, geen skip).
- Wacht op async job tot `status: ready`.
- Download ZIP; controleer:
  - `copy.csv`, `README.md`
  - `static/` (3 angles × 1:1 + 4:5)
  - `video/` (≥1 Reel 9:16 of expliciete skip in errors)
  - `meta/asset_feed_spec.json`

### Stap 3 — Meta upload (handmatig)

- Ads Manager → Campaign → Ad set → **Advantage+ creative** of dynamic creative.
- Upload static + video uit ZIP.
- Map headlines/descriptions uit `asset_feed_spec.json` of `copy.csv`.
- **Geen live spend** in week 1 — policy review only.

### Stap 4 — Feedback

- Beta-user vult feedbackformulier in (zie onder).
- Engineering fixt P0 binnen 48u (reject, policy fail, ZIP corrupt).

### Stap 5 — Locale-expansie

- **nl-NL gate groen** → herhaal 3 producten **de-DE**.
- **de-DE gate groen** → herhaal 3 producten **en-EU**.

---

## Kill rules (Meta)

Stop beta-spend / pause uploads als:

1. **Ad reject** wegens health/medical claim (genezen, medicijn, kinderen).
2. **Ad reject** wegens misleidende betaalclaim (iDEAL, creditcard, PayPal bij Fumero).
3. **Account warning** of policy strike op ad account.
4. **SSIM < 0,75** op 1:1 na retry (product onherkenbaar).
5. **NPS < 5** na eerste 2 users — root-cause vóór meer testers.

Bij kill: documenteer reject-reason, pack-id, copy set angle; fix `meta-policy` of scene prompt.

---

## Feedbackformulier (vragen)

1. Hoe makkelijk was de wizard (1–10)?
2. Klopten de 3 advertentieconcepten bij je product (1–10)?
3. Zou je de gegenereerde copy **zonder grote edits** in Meta zetten (ja/nee + waarom)?
4. Zagen de static creatives er **merkwaardig** uit (1–10)?
5. Was de productherkenning goed genoeg vs. je productfoto (1–10)?
6. Downloadde de ZIP en opende die zonder fouten (ja/nee)?
7. Hoeveel minuten duurde generatie (met media)?
8. Wat miste je het meest (vrij tekst)?
9. **NPS:** Hoe waarschijnlijk beveel je Campaign Studio aan aan een collega (0–10)?
10. Locale: nl / de / en — paste de taal en tone of voice?

---

## Locale testchecklist (nl / de / en)

### nl-NL (primair)

- [ ] Wizard UI Nederlands
- [ ] Geen iDEAL/creditcard in copy
- [ ] 18+ / AVG-toon waar relevant
- [ ] README in ZIP Nederlands

### de-DE (na nl gate)

- [ ] Headlines ≤ 40 tekens, geen NL leenwoorden
- [ ] Geen UWG-health claims
- [ ] Scene presets passen bij DE markt

### en-EU (na de gate)

- [ ] GDPR-neutrale formulering
- [ ] Geen US-only payment claims
- [ ] CTA's uit `call_to_action_types` in asset_feed_spec

---

## Automatische verificatie

```bash
cd /home/pietje/AI_HQ/ai-motor
BASE_URL=http://127.0.0.1:3040 node scripts/test-campaign-full-media.mjs
BASE_URL=http://127.0.0.1:3040 node scripts/test-campaign-strategy.mjs
```

---

## Referenties

- Platform roadmap: `docs/MOTOR-CONTENT-DEPARTMENT-ROADMAP.md` (Stap 8)
- Handmatige checklist: `TESTING.md`
- Meta skeleton: `lib/photo-studio/campaign/asset-feed-spec.ts`
