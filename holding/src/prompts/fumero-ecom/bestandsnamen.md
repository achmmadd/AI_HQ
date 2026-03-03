# Fumero Blog — Bestandsnaming Conventies

> Gebruik deze naamconventie voor alle blog-afbeeldingen van Fumero.nl zodat bestanden automatisch SEO-vriendelijk zijn.

---

## Naamformaat

```
fumero-[artikel-slug]-[type]-[nummer].jpg
```

| Onderdeel | Uitleg | Voorbeeld |
|-----------|--------|-----------|
| `fumero-` | Vaste prefix (merkherkenning + SEO) | `fumero-` |
| `[artikel-slug]` | URL-slug van het blogartikel (kleine letters, koppeltekens) | `beste-espressomachines-2025` |
| `[type]` | Beeldtype (zie tabel hieronder) | `hero` |
| `[nummer]` | Alleen voor inline beelden (01, 02, …) | `01` |
| `.jpg` | Standaard formaat (JPEG voor foto's) | `.jpg` |

---

## Beeldtypen en naamextensies

| Beeldtype | Naamconventie | Voorbeeld |
|-----------|--------------|-----------|
| Hero image | `fumero-[slug]-hero.jpg` | `fumero-beste-espressomachines-2025-hero.jpg` |
| OG image | `fumero-[slug]-og.jpg` | `fumero-beste-espressomachines-2025-og.jpg` |
| Featured image | `fumero-[slug]-featured.jpg` | `fumero-beste-espressomachines-2025-featured.jpg` |
| Inline illustratie | `fumero-[slug]-inline-[nn].jpg` (bijv. `01`, `02`) | `fumero-beste-espressomachines-2025-inline-01.jpg` |
| Comparison image | `fumero-[slug]-comparison.jpg` | `fumero-beste-espressomachines-2025-comparison.jpg` |

---

## Slug-regels

- Gebruik **dezelfde slug** als de URL van het blogartikel.
- Alleen **kleine letters**, geen spaties (gebruik koppeltekens `-`).
- Geen speciale tekens of accenten (gebruik `ae` in plaats van `ä`).
- Maximaal **60 tekens** voor de slug (exclusief prefix en type).

**Voorbeelden slugs:**

| Blogartikel | Slug |
|-------------|------|
| Beste espressomachines 2025 | `beste-espressomachines-2025` |
| Hoe kies je de juiste koffiemolen? | `hoe-kies-je-de-juiste-koffiemolen` |
| Top 5 koffiezetapparaten onder €200 | `top-5-koffiezetapparaten-onder-200` |

---

## Opslag en upload

- Sla alle gegenereerde beelden lokaal op in een map met de artikel-slug als naam.
- Upload naar het CMS (WordPress/Webflow) en gebruik de bestandsnaam als alt-tekst basis.
- Zorg dat bestanden geoptimaliseerd zijn (max 200 KB voor hero/OG, max 120 KB voor inline).
