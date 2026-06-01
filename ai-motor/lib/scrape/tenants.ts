import type { ScrapeTenantConfig, ScrapeTenantId } from "@/lib/scrape/types";

/**
 * Per-tenant scrape + kennisbank-config (wrap-ready).
 * Nieuwe bedrijven: voeg entry toe of laad later uit DB — zelfde Motor-engine.
 */
const TENANT_REGISTRY: Record<string, ScrapeTenantConfig> = {
  fumero: {
    id: "fumero",
    displayName: "Fumero",
    domainWhitelist: [
      "fumero.nl",
      "bigfarmers.nl",
      "hhcshop.nl",
      "nos.nl",
    ],
    kennisbankRefreshPages: [
      "https://fumero.nl/shop/",
      "https://fumero.nl/contact/",
      "https://fumero.nl/betaalmethoden/",
      "https://fumero.nl/hhc-gebruikershandleiding/",
      "https://fumero.nl/product-category/hhc-vapes/",
      "https://fumero.nl/product-category/hhc-gummies/",
    ],
    kennisbankCollection:
      process.env.QDRANT_FUMERO_KENNISBANK_COLLECTION?.trim() ||
      "fumero_kennisbank",
  },
  bokas: {
    id: "bokas",
    displayName: "Bokas",
    domainWhitelist: [],
    kennisbankRefreshPages: [],
    kennisbankCollection:
      process.env.QDRANT_BOKAS_KENNISBANK_COLLECTION?.trim() ||
      "bokas_kennisbank",
  },
};

export function listScrapeTenants(): ScrapeTenantConfig[] {
  return Object.values(TENANT_REGISTRY);
}

export function getScrapeTenantConfig(
  tenantId: ScrapeTenantId
): ScrapeTenantConfig | null {
  const k = tenantId.trim().toLowerCase();
  return TENANT_REGISTRY[k] ?? null;
}

export function requireScrapeTenantConfig(
  tenantId: ScrapeTenantId
): ScrapeTenantConfig {
  const cfg = getScrapeTenantConfig(tenantId);
  if (!cfg) {
    throw new Error(`Onbekende scrape-tenant: ${tenantId}`);
  }
  return cfg;
}
