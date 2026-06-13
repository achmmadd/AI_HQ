import type { BrandKitRow } from "@/lib/photo-studio/brand-kit/types";
import type { CompanyId } from "@/lib/types";
import {
  FUMERO_BRAND_VOICE,
  FUMERO_FACTS,
} from "@/lib/photo-studio/campaign/brand-voice";
import type { CampaignPolicyProfileId } from "@/lib/photo-studio/campaign/meta-policy";

export type CampaignLocale = "nl" | "de" | "en";

const LOCALE_LABELS: Record<CampaignLocale, string> = {
  nl: "Nederlands",
  de: "Deutsch",
  en: "English",
};

/** Detect locale from product URL host (.nl / .de / .com). */
export function detectLocaleFromUrl(url: string | null | undefined): CampaignLocale | null {
  if (!url?.trim()) return null;
  try {
    const host = new URL(url.trim()).hostname.toLowerCase();
    if (host.endsWith(".de") || host.includes(".de.")) return "de";
    if (host.endsWith(".com") || host.includes(".com.")) return "en";
    if (host.endsWith(".nl") || host.includes(".nl.")) return "nl";
  } catch {
    /* ignore */
  }
  return null;
}

export function resolveCampaignLocale(kit: BrandKitRow): CampaignLocale {
  if (kit.locale === "nl" || kit.locale === "de" || kit.locale === "en") {
    return kit.locale;
  }
  return detectLocaleFromUrl(kit.source_url) ?? "nl";
}

export function localeLabel(locale: CampaignLocale): string {
  return LOCALE_LABELS[locale];
}

export function resolvePolicyProfile(kit: BrandKitRow): CampaignPolicyProfileId {
  if (kit.policy_profile === "default_ecom" || kit.policy_profile === "fumero_hhc") {
    return kit.policy_profile;
  }
  if (kit.klant === "fumero") return "fumero_hhc";
  const url = kit.source_url?.toLowerCase() ?? "";
  if (/fumero\.(nl|de|com)/.test(url) || /\bhhc\b|\bcbd\b/i.test(kit.description ?? "")) {
    return "fumero_hhc";
  }
  return "default_ecom";
}

export function buildBrandVoice(kit: BrandKitRow): string {
  const locale = resolveCampaignLocale(kit);
  const brand = kit.name?.trim() || kit.klant;
  const lang = localeLabel(locale);

  if (kit.klant === "fumero" || resolvePolicyProfile(kit) === "fumero_hhc") {
    return FUMERO_BRAND_VOICE.replace("Nederlandse", lang === "Deutsch" ? "Deutsche" : lang === "English" ? "English" : "Nederlandse");
  }

  return (
    `${brand} — premium e-commerce (${lang}). ` +
    "Toon: helder, betrouwbaar, geen misleidende claims. Doelgroep volwassenen waar van toepassing."
  );
}

export function buildBrandFacts(kit: BrandKitRow): string[] {
  if (kit.klant === "fumero" || resolvePolicyProfile(kit) === "fumero_hhc") {
    return [...FUMERO_FACTS];
  }
  const facts: string[] = [];
  if (kit.price) facts.push(`Prijs: ${kit.price} ${kit.currency || "EUR"}.`);
  if (kit.source_url) facts.push(`Productpagina: ${kit.source_url}.`);
  return facts;
}

export function resolveTenantKlant(kit: BrandKitRow): CompanyId {
  return kit.klant;
}

export function campaignAssetPublicUrl(
  packId: string,
  folder: "static" | "video",
  filename: string
): string {
  return `/api/fumero/campaign/assets/${encodeURIComponent(packId)}/${folder}/${encodeURIComponent(filename)}`;
}
