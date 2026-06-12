import { normalizePriceString } from "@/lib/photo-studio/brand-kit/format-price";
import type { BrandKitReview } from "@/lib/photo-studio/brand-kit/types";

export type ParsedProductPage = {
  product_name: string;
  price: string | null;
  currency: string;
  description: string;
  images: Array<{ url: string; alt?: string }>;
  reviews: BrandKitReview[];
  warnings: string[];
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function metaContent(html: string, property: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const m = html.match(re);
  if (m?.[1]) return decodeHtmlEntities(m[1]);
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    "i"
  );
  return decodeHtmlEntities(re2.exec(html)?.[1] ?? "") || null;
}

function titleFromHtml(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m?.[1] ? decodeHtmlEntities(m[1]) : null;
}

function stripSiteSuffix(title: string): string {
  return title.replace(/\s*[|\-–—]\s*Fumero.*$/i, "").trim();
}

function parseJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim()) as unknown;
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      /* skip invalid JSON-LD */
    }
  }
  return blocks;
}

function flattenJsonLd(nodes: unknown[]): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  for (const node of nodes) {
    if (!node || typeof node !== "object") continue;
    const obj = node as Record<string, unknown>;
    if (Array.isArray(obj["@graph"])) {
      for (const g of obj["@graph"] as unknown[]) {
        if (g && typeof g === "object") out.push(g as Record<string, unknown>);
      }
    } else {
      out.push(obj);
    }
  }
  return out;
}

function isProductType(obj: Record<string, unknown>): boolean {
  const t = obj["@type"];
  if (t === "Product") return true;
  if (Array.isArray(t)) return t.includes("Product");
  return false;
}

function priceFromSpecification(
  offer: Record<string, unknown>
): { price: string | null; currency: string } | null {
  const specRaw = offer.priceSpecification;
  const specs = Array.isArray(specRaw) ? specRaw : specRaw ? [specRaw] : [];
  for (const spec of specs) {
    if (!spec || typeof spec !== "object") continue;
    const s = spec as Record<string, unknown>;
    const price = normalizePriceString(
      typeof s.price === "string" || typeof s.price === "number"
        ? String(s.price)
        : null
    );
    if (price) {
      return {
        price,
        currency:
          typeof s.priceCurrency === "string" ? s.priceCurrency : "EUR",
      };
    }
  }
  return null;
}

function offerPrice(offer: Record<string, unknown> | undefined): {
  price: string | null;
  currency: string;
} {
  if (!offer) return { price: null, currency: "EUR" };

  const fromSpec = priceFromSpecification(offer);
  if (fromSpec) return fromSpec;

  const currency =
    typeof offer.priceCurrency === "string" ? offer.priceCurrency : "EUR";

  const rawPrice =
    typeof offer.price === "string" || typeof offer.price === "number"
      ? String(offer.price)
      : typeof offer.lowPrice === "string" || typeof offer.lowPrice === "number"
        ? String(offer.lowPrice)
        : null;

  return { price: normalizePriceString(rawPrice), currency };
}

/** WooCommerce product block — avoids sidebar/related-product prices. */
export function extractProductSectionHtml(html: string): string {
  const entryRe = /<div[^>]+class="[^"]*\bentry-summary\b[^"]*"[^>]*>/i;
  const entryMatch = entryRe.exec(html);
  if (entryMatch?.index != null) {
    return html.slice(entryMatch.index, entryMatch.index + 12_000);
  }

  const productById = html.match(
    /<div[^>]+id="product-\d+"[^>]*>[\s\S]{100,8000}/i
  );
  if (productById?.[0]) return productById[0];

  const singleProduct = html.match(
    /<div[^>]+class="[^"]*\bsingle-product\b[^"]*"[^>]*>[\s\S]{100,8000}/i
  );
  if (singleProduct?.[0]) return singleProduct[0];

  return html;
}

function reviewsFromJsonLd(obj: Record<string, unknown>): BrandKitReview[] {
  const reviews: BrandKitReview[] = [];
  const agg = obj.aggregateRating as Record<string, unknown> | undefined;
  if (agg && typeof agg.ratingValue !== "undefined") {
    reviews.push({
      author: "Gemiddelde beoordeling",
      rating: Number(agg.ratingValue),
      text:
        typeof agg.reviewCount !== "undefined"
          ? `${agg.reviewCount} beoordelingen`
          : undefined,
    });
  }
  const raw = obj.review;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const rating = r.reviewRating as Record<string, unknown> | undefined;
    reviews.push({
      author:
        typeof (r.author as Record<string, unknown>)?.name === "string"
          ? ((r.author as Record<string, unknown>).name as string)
          : typeof r.author === "string"
            ? r.author
            : undefined,
      rating:
        typeof rating?.ratingValue !== "undefined"
          ? Number(rating.ratingValue)
          : undefined,
      text: typeof r.reviewBody === "string" ? r.reviewBody : undefined,
      date: typeof r.datePublished === "string" ? r.datePublished : undefined,
    });
  }
  return reviews;
}

function imagesFromJsonLd(obj: Record<string, unknown>): Array<{ url: string; alt?: string }> {
  const images: Array<{ url: string; alt?: string }> = [];
  const raw = obj.image;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const item of list) {
    if (typeof item === "string") images.push({ url: item });
    else if (item && typeof item === "object") {
      const img = item as Record<string, unknown>;
      if (typeof img.url === "string") {
        images.push({
          url: img.url,
          alt: typeof img.name === "string" ? img.name : undefined,
        });
      }
    }
  }
  return images;
}

function wooPriceFromHtml(html: string): string | null {
  const scoped = extractProductSectionHtml(html);
  const patterns = [
    /itemprop="price"[^>]+content=["']([^"']+)["']/i,
    /class="[^"]*woocommerce-Price-amount[^"]*amount"[^>]*>[\s\S]*?(\d+[.,]\d{2})/i,
    /<p[^>]+class="[^"]*price[^"]*"[^>]*>[\s\S]*?(\d+[.,]\d{2})/i,
    /class="[^"]*woocommerce-Price-amount[^"]*"[^>]*>[\s\S]*?(\d+[.,]\d{2})/i,
  ];
  for (const re of patterns) {
    const m = scoped.match(re);
    if (m?.[1]) {
      const normalized = normalizePriceString(m[1]);
      if (normalized) return normalized;
    }
  }
  return null;
}

function galleryImagesFromHtml(html: string, baseUrl: string): Array<{ url: string; alt?: string }> {
  const images: Array<{ url: string; alt?: string }> = [];
  const seen = new Set<string>();

  const add = (raw: string, alt?: string) => {
    const url = resolveUrl(raw, baseUrl);
    if (!url || seen.has(url)) return;
    seen.add(url);
    images.push({ url, alt });
  };

  const og = metaContent(html, "og:image");
  if (og) add(og);

  const galleryRe =
    /data-(?:large_image|src|thumb)="([^"]+)"|src="(https?:\/\/[^"]+\/wp-content\/uploads\/[^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = galleryRe.exec(html)) !== null) {
    add(m[1] || m[2]);
  }

  return images;
}

function resolveUrl(raw: string, baseUrl: string): string | null {
  try {
    return new URL(raw, baseUrl).href;
  } catch {
    return null;
  }
}

function descriptionFromHtml(html: string): string {
  const og = metaContent(html, "og:description");
  if (og) return og;
  const metaDesc = metaContent(html, "description");
  if (metaDesc) return metaDesc;
  const woo = html.match(
    /class="[^"]*woocommerce-product-details__short-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i
  );
  if (woo?.[1]) {
    return decodeHtmlEntities(woo[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
  }
  return "";
}

/** Parse WooCommerce / JSON-LD product page HTML into structured fields. */
export function parseProductPageHtml(html: string, pageUrl: string): ParsedProductPage {
  const warnings: string[] = [];
  const jsonNodes = flattenJsonLd(parseJsonLdBlocks(html));
  const productNode = jsonNodes.find(isProductType);

  let product_name = "";
  let price: string | null = null;
  let currency = "EUR";
  let description = "";
  let images: Array<{ url: string; alt?: string }> = [];
  let reviews: BrandKitReview[] = [];

  if (productNode) {
    product_name =
      typeof productNode.name === "string" ? decodeHtmlEntities(productNode.name) : "";
    description =
      typeof productNode.description === "string"
        ? decodeHtmlEntities(productNode.description.replace(/<[^>]+>/g, " "))
        : "";
    const offerRaw = productNode.offers;
    const offer = Array.isArray(offerRaw)
      ? (offerRaw[0] as Record<string, unknown>)
      : (offerRaw as Record<string, unknown> | undefined);
    const parsedOffer = offerPrice(offer);
    price = parsedOffer.price;
    currency = parsedOffer.currency;
    if (!price && offer) {
      const high =
        typeof offer.highPrice === "string" || typeof offer.highPrice === "number"
          ? normalizePriceString(String(offer.highPrice))
          : null;
      if (high) price = high;
    }
    images = imagesFromJsonLd(productNode);
    reviews = reviewsFromJsonLd(productNode);
  } else {
    warnings.push("Geen JSON-LD Product gevonden — fallback op meta-tags.");
  }

  const ogTitle = metaContent(html, "og:title");
  if (!product_name && ogTitle) product_name = stripSiteSuffix(ogTitle);
  if (!product_name) {
    const t = titleFromHtml(html);
    if (t) product_name = stripSiteSuffix(t);
  }

  if (!description) description = descriptionFromHtml(html);
  if (!price) {
    price = wooPriceFromHtml(html);
    if (price) {
      warnings.push("Prijs via HTML-fallback (productblok) — controleer handmatig.");
    }
  }

  const gallery = galleryImagesFromHtml(html, pageUrl);
  if (gallery.length) {
    const merged = [...images];
    const seen = new Set(merged.map((i) => i.url));
    for (const g of gallery) {
      if (!seen.has(g.url)) merged.push(g);
    }
    images = merged;
  }

  if (!product_name) warnings.push("Productnaam niet gevonden.");
  if (!price) warnings.push("Prijs niet gevonden.");
  if (!images.length) warnings.push("Geen productafbeeldingen gevonden.");

  return {
    product_name,
    price,
    currency,
    description,
    images,
    reviews,
    warnings,
  };
}
