import type { BrandKitData } from "@/lib/photo-studio/brand-kit/types";

export type ImportSummaryLine = {
  ok: boolean;
  text: string;
};

/** Human-readable checklist after a URL import. */
export function buildImportSummary(draft: BrandKitData): ImportSummaryLine[] {
  const lines: ImportSummaryLine[] = [];

  lines.push({
    ok: Boolean(draft.product_name?.trim()),
    text: draft.product_name?.trim()
      ? "Productnaam gevonden"
      : "Productnaam niet gevonden",
  });

  lines.push({
    ok: Boolean(draft.price?.trim()),
    text: draft.price?.trim() ? "Prijs gevonden" : "Prijs niet gevonden",
  });

  const imageCount = draft.images.length;
  lines.push({
    ok: imageCount > 0,
    text:
      imageCount > 0
        ? `${imageCount} afbeelding${imageCount === 1 ? "" : "en"} gevonden`
        : "Geen afbeeldingen gevonden",
  });

  lines.push({
    ok: draft.colors.length > 0,
    text:
      draft.colors.length > 0
        ? "Kleuren geëxtraheerd"
        : "Geen kleuren geëxtraheerd",
  });

  const hasReviews = draft.reviews.some((r) => r.text?.trim() || r.rating);
  lines.push({
    ok: hasReviews,
    text: hasReviews ? "Reviews gevonden" : "Reviews ontbreken",
  });

  return lines;
}
