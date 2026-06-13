import type { CampaignLocale } from "@/lib/photo-studio/campaign/tenant-profile";
import type { CampaignPolicyProfileId } from "@/lib/photo-studio/campaign/meta-policy";
import type { CompanyId } from "@/lib/types";

export type BrandKitSource = "url_import" | "manual";

export type BrandKitStatus = "draft" | "confirmed";

export type BrandKitReview = {
  author?: string;
  rating?: number;
  text?: string;
  date?: string;
};

export type BrandKitColorRole = "primary" | "secondary" | "accent" | "neutral";

export type BrandKitColor = {
  hex: string;
  label?: string;
  role?: BrandKitColorRole;
};

export type BrandKitImageRole = "product" | "logo" | "gallery" | "other";

export type BrandKitImage = {
  url: string;
  alt?: string;
  role?: BrandKitImageRole;
};

/** Editable Brand Kit payload — used for import drafts and saved records. */
export type BrandKitData = {
  name: string;
  product_name: string;
  price: string | null;
  currency: string;
  description: string;
  source_url: string | null;
  source: BrandKitSource;
  reviews: BrandKitReview[];
  images: BrandKitImage[];
  colors: BrandKitColor[];
  logo_url: string | null;
  status: BrandKitStatus;
  import_warnings?: string[];
  /** Copy/strategy language — defaults from source_url TLD when unset. */
  locale?: CampaignLocale;
  /** Meta policy profile override (tenant/branche). */
  policy_profile?: CampaignPolicyProfileId;
};

export type BrandKitRow = BrandKitData & {
  id: string;
  klant: CompanyId;
  created_at: string;
  updated_at: string;
};

export type BrandKitImportResult =
  | { ok: true; draft: BrandKitData; elapsed_ms: number }
  | { ok: false; error: string; fallback?: BrandKitData };

export function emptyBrandKitDraft(source: BrandKitSource = "manual"): BrandKitData {
  return {
    name: "",
    product_name: "",
    price: null,
    currency: "EUR",
    description: "",
    source_url: null,
    source,
    reviews: [],
    images: [],
    colors: [],
    logo_url: null,
    status: "draft",
    import_warnings: [],
    locale: "nl",
  };
}

function hasProductImage(data: BrandKitData): boolean {
  return data.images.some((i) => i.role === "product" || i.role === undefined);
}

export function validateBrandKitData(data: BrandKitData): string | null {
  if (!data.name.trim()) return "Naam is verplicht.";
  if (!data.product_name.trim()) return "Productnaam is verplicht.";
  if (data.currency && !/^[A-Z]{3}$/.test(data.currency)) {
    return "Valuta moet een ISO-code zijn (bv. EUR).";
  }
  if (data.status === "confirmed") {
    if (!data.description.trim()) {
      return "Beschrijving is verplicht bij bevestigen.";
    }
    if (!data.price?.trim()) {
      return "Prijs is verplicht bij bevestigen.";
    }
    if (!hasProductImage(data)) {
      return "Productfoto is verplicht bij bevestigen.";
    }
  }
  return null;
}
