# Flair AI — Stap-voor-stap Instructies

Flair AI is de kern van de Fumero productbeelden workflow. Gebruik het om realistische productscènes te genereren met professionele achtergronden.

---

## 🚀 Account & Setup

1. Ga naar [https://flair.ai](https://flair.ai) en log in op het Fumero Pro account.
2. Controleer dat je in de **"Brand" workspace** zit: *Fumero.nl*.
3. Zorg dat je Brand Assets zijn geüpload (logo PNG, kleurenpalet — zie `config/canva-brand-kit.json`).

---

## 📁 Stap 1 — Productfoto voorbereiden

| Vereiste | Details |
|----------|---------|
| Formaat | PNG met transparante achtergrond, **of** JPG op witte achtergrond |
| Resolutie | Minimaal **1000 × 1000 px** |
| Bestandsnaam | `{categorie}-{productnaam}-input.png` (bijv. `vapes-strawberry-pie-input.png`) |

**Tip:** Gebruik [Remove.bg](https://www.remove.bg) om snel de achtergrond te verwijderen voor €0 (gratis tier = 50 credits/maand).

---

## 🎨 Stap 2 — Nieuw project aanmaken in Flair AI

1. Klik **"New Project"** → kies formaat **Square (1:1)** of **Portrait (4:5)**.
2. Sleep je productfoto naar het canvas.
3. Pas de grootte aan zodat het product ~60–70% van het canvas vult.
4. Positioneer het product iets **onder het middelpunt** (geeft meer ruimte voor achtergrond).

---

## ✍️ Stap 3 — Prompt invoeren

Gebruik de prompt-templates uit `prompts/prompt-templates.md`.

**Structuur van een goede prompt:**
```
[SFEER/OMGEVING], [VERLICHTING], [STIJL], product photography, ultra realistic, 8k, no text
```

**Voorbeeld voor vapes:**
```
misty forest floor with soft morning light, golden hour glow, premium lifestyle product photography, ultra realistic, 8k, no text
```

**Vermijd in prompts:**
- Tekst of logo-verzoeken (`add text`, `with brand name`)
- Handen of personen (tenzij lifestyle shoot)
- Specifieke merkbenamingen van concurrenten

---

## ⚙️ Stap 4 — Generatie-instellingen

| Instelling | Aanbevolen waarde |
|------------|------------------|
| Style | `Photorealistic` |
| Lighting | `Natural` of `Studio` afhankelijk van product |
| Iterations | `4` (genereer 4 varianten, kies de beste) |
| Seed | Noteer de seed van favoriete resultaten! |
| Resolution | `High (2048px)` |

---

## 🖼️ Stap 5 — Selecteren & verfijnen

1. Bekijk alle 4 varianten.
2. Selecteer de 1–2 beste.
3. Gebruik **Inpainting** om storende elementen weg te halen (schaduwen, artefacten).
4. Gebruik **"Expand"** als je een ander formaat wil (bijv. 16:9 voor banner).

---

## 💾 Stap 6 — Exporteren

1. Klik **"Download"** → kies **PNG (transparante achtergrond)** als je nog Canva bewerking gaat doen, anders **JPG**.
2. Kies **maximale resolutie**.
3. Sla op met naamconventie:

```
{categorie}-{productnaam}-{variant#}-raw.{ext}

Voorbeelden:
vapes-strawberry-pie-v1-raw.png
gummies-tropical-mix-v2-raw.jpg
cookies-chocolate-chunk-v1-raw.png
```

---

## 🔁 Batch Workflow (meerdere producten tegelijk)

Voor batch verwerking, zie `workflow/batch-templates.md`.

**Flair AI batch-tip:**
- Maak een **"Collection"** aan per productcategorie (bijv. *Vapes Q1 2025*).
- Upload alle product-PNG's tegelijk.
- Gebruik dezelfde prompt voor consistentie binnen een categorie.
- Genereer → download als ZIP.

---

## ✅ Kwaliteitscheck Checklist

Controleer elk beeld voordat je doorgaat naar Canva:

- [ ] Product is scherp en volledig zichtbaar
- [ ] Geen onnatuurlijke artefacten rondom het product
- [ ] Achtergrond past bij het merk (premium, clean)
- [ ] Kleuren zijn realistisch (niet over-gesatureerd)
- [ ] Geen ongewenste tekst of logo's zichtbaar
- [ ] Resolutie minimaal 1500px breed

---

## 🎯 Categorie-specifieke Tips

### Vapes
- Gebruik **dark/moody** achtergronden (donkerblauw, zwart, bos)
- Voeg subtiele **rook/damp** toe met: `soft wisps of vapor, moody atmosphere`

### Gummies
- Gebruik **helder, kleurrijk** (wit, pastel, fruitige kleuren)
- Prompt toevoeging: `vibrant candy colors, glossy surface, macro detail`

### Cookies
- Gebruik **warme, huiselijke** sfeer (hout, linnen, keuken)
- Prompt toevoeging: `warm bakery lighting, rustic wooden surface, cozy kitchen`

### Truffels
- Gebruik **luxe, donker** (zwart fluweel, goud, mos)
- Prompt toevoeging: `luxury dark background, gold accents, mystical forest floor`

### Candy
- Gebruik **speels, kleurexplosie** (pastel, snoepwinkel, neon)
- Prompt toevoeging: `playful colorful background, candy store aesthetic, pop art style`
