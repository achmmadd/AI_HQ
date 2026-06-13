import { BRAND_LOGO, FUMERO_BRAND } from "@/lib/fumero/brand-assets";
import { assertScrapeUrlAllowed } from "@/lib/scrape/scrape-url";
import { extractColorsFromImageUrl } from "@/lib/photo-studio/brand-kit/extract-colors";
import { parseProductPageHtml } from "@/lib/photo-studio/brand-kit/parse-product-page";
import type {
  BrandKitColor,
  BrandKitData,
  BrandKitImportResult,
} from "@/lib/photo-studio/brand-kit/types";
import { dedupeBrandKitColors } from "@/lib/photo-studio/brand-kit/dedupe-colors";
import { emptyBrandKitDraft } from "@/lib/photo-studio/brand-kit/types";
import { detectLocaleFromUrl } from "@/lib/photo-studio/campaign/tenant-profile";

const IMPORT_TIMEOUT_MS = 25_000;

async function fetchProductHtml(url: string): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "MotorsAI-BrandKit/1.0 (+fumero product import)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(IMPORT_TIMEOUT_MS),
    });
    if (!res.ok) {
      return { ok: false, error: `Pagina ophalen mislukt (HTTP ${res.status}).` };
    }
    return { ok: true, html: await res.text() };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: `Pagina ophalen mislukt: ${msg}` };
  }
}

function fumeroFallbackDraft(url: string, error: string): BrandKitData {
  const draft = emptyBrandKitDraft("url_import");
  draft.source_url = url;
  draft.name = "Nieuw Brand Kit";
  draft.logo_url = BRAND_LOGO.src;
  draft.colors = [
    { hex: FUMERO_BRAND.accent, label: "Fumero accent", role: "accent" },
    { hex: FUMERO_BRAND.logoGreen, label: "Fumero groen", role: "primary" },
  ];
  draft.import_warnings = [
    error,
    "Vul productgegevens handmatig aan of upload logo en productfoto.",
  ];
  return draft;
}

function colorsFromExtracted(
  extracted: Array<{ hex: string; ratio: number }>,
  brandAccent: string
): BrandKitColor[] {
  const roles: BrandKitColor["role"][] = [
    "primary",
    "secondary",
    "accent",
    "neutral",
    "neutral",
  ];
  const colors: BrandKitColor[] = extracted.map((c, i) => ({
    hex: c.hex,
    label: i === 0 ? "Dominant" : `Kleur ${i + 1}`,
    role: roles[i] ?? "neutral",
  }));
  if (!colors.some((c) => c.hex.toLowerCase() === brandAccent.toLowerCase())) {
    colors.unshift({
      hex: brandAccent,
      label: "Fumero accent",
      role: "accent",
    });
  }
  return dedupeBrandKitColors(colors.slice(0, 6));
}

/** Import Brand Kit fields from a fumero.nl product URL. */
export async function importBrandKitFromUrl(url: string): Promise<BrandKitImportResult> {
  const started = Date.now();
  const trimmed = url.trim();

  const deny = assertScrapeUrlAllowed(trimmed, "fumero");
  if (deny) {
    return { ok: false, error: deny, fallback: fumeroFallbackDraft(trimmed, deny) };
  }

  const fetched = await fetchProductHtml(trimmed);
  if (!fetched.ok) {
    return {
      ok: false,
      error: fetched.error,
      fallback: fumeroFallbackDraft(trimmed, fetched.error),
    };
  }

  const parsed = parseProductPageHtml(fetched.html, trimmed);
  const warnings = [...parsed.warnings];

  let colors: BrandKitColor[] = [
    { hex: FUMERO_BRAND.accent, label: "Fumero accent", role: "accent" },
    { hex: FUMERO_BRAND.logoGreen, label: "Fumero groen", role: "primary" },
  ];

  const primaryImage = parsed.images[0]?.url;
  if (primaryImage) {
    try {
      const extracted = await extractColorsFromImageUrl(primaryImage, {
        maxColors: 4,
        timeoutMs: 8000,
      });
      if (extracted.length) {
        colors = colorsFromExtracted(extracted, FUMERO_BRAND.accent);
      }
    } catch {
      warnings.push("Kleurextractie mislukt — standaard Fumero-kleuren gebruikt.");
    }
  }

  const draft: BrandKitData = {
    name: parsed.product_name || "Nieuw Brand Kit",
    product_name: parsed.product_name,
    price: parsed.price,
    currency: parsed.currency || "EUR",
    description: parsed.description,
    source_url: trimmed,
    source: "url_import",
    reviews: parsed.reviews,
    images: parsed.images.map((img, i) => ({
      url: img.url,
      alt: img.alt,
      role: i === 0 ? "product" : "gallery",
    })),
    colors,
    logo_url: BRAND_LOGO.src,
    status: "draft",
    import_warnings: warnings,
    locale: detectLocaleFromUrl(trimmed) ?? "nl",
  };

  return { ok: true, draft, elapsed_ms: Date.now() - started };
}
