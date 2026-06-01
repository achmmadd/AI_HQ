/**
 * Fumero-compat laag — implementatie zit in lib/scrape (multi-tenant, wrap-ready).
 */
import { requireScrapeTenantConfig } from "@/lib/scrape/tenants";
import {
  scrapeUrlHostnameAllowedForTenant,
} from "@/lib/scrape/scrape-url";

const fumero = requireScrapeTenantConfig("fumero");

/** @deprecated Gebruik getScrapeTenantConfig("fumero").domainWhitelist */
export const SCRAPE_URL_DOMAIN_WHITELIST = fumero.domainWhitelist;

/** @deprecated Gebruik getScrapeTenantConfig("fumero").kennisbankRefreshPages */
export const FUMERO_KENNISBANK_REFRESH_PAGES = fumero.kennisbankRefreshPages;

export type { ScrapeUrlResult } from "@/lib/scrape/types";

export {
  normalizeScrapeUrl,
  scrapeUrlDocumentId,
  chunkMarkdownForQdrant,
  assertScrapeUrlAllowed,
  scrapeUrl,
  scrapeUrlViaJina,
  isScrapeConfigured,
  isJinaScrapeConfigured,
  activeScrapeProviderLabel,
} from "@/lib/scrape/scrape-url";

export function scrapeUrlHostnameAllowed(hostname: string): boolean {
  return scrapeUrlHostnameAllowedForTenant(hostname, "fumero");
}
