import {
  assertScrapeUrlAllowedForTenant,
  scrapeUrlHostnameAllowed,
} from "@/lib/scrape/normalize";
import {
  getScrapeProviderMode,
  scrapeWithProvider,
  isScrapeConfigured,
  activeScrapeProviderLabel,
} from "@/lib/scrape/providers/resolve";
import { isJinaScrapeConfigured } from "@/lib/scrape/providers/jina";
import { requireScrapeTenantConfig } from "@/lib/scrape/tenants";
import type { ScrapeProviderMode } from "@/lib/scrape/providers/resolve";
import type { ScrapeTenantId, ScrapeUrlResult } from "@/lib/scrape/types";

export {
  normalizeScrapeUrl,
  scrapeUrlDocumentId,
  chunkMarkdownForQdrant,
} from "@/lib/scrape/normalize";

export {
  getScrapeTenantConfig,
  requireScrapeTenantConfig,
  listScrapeTenants,
} from "@/lib/scrape/tenants";

export { isScrapeConfigured, getScrapeProviderMode, activeScrapeProviderLabel };
export { isJinaScrapeConfigured };

export { scrapeViaJina } from "@/lib/scrape/providers/jina";
export { scrapeViaNativeFetch } from "@/lib/scrape/providers/native";

export function assertScrapeUrlAllowed(
  url: string,
  tenantId: ScrapeTenantId = "fumero"
): string | null {
  const tenant = requireScrapeTenantConfig(tenantId);
  return assertScrapeUrlAllowedForTenant(url, tenant.domainWhitelist);
}

export function scrapeUrlHostnameAllowedForTenant(
  hostname: string,
  tenantId: ScrapeTenantId = "fumero"
): boolean {
  const tenant = requireScrapeTenantConfig(tenantId);
  return scrapeUrlHostnameAllowed(hostname, tenant.domainWhitelist);
}

/** Tenant-aware URL reader — gebruik dit in chat, API en cron. */
export async function scrapeUrl(opts: {
  url: string;
  tenant?: ScrapeTenantId;
  reason?: string;
  provider?: ScrapeProviderMode;
  timeoutMs?: number;
  maxChars?: number;
}): Promise<ScrapeUrlResult> {
  const tenantId = (opts.tenant ?? "fumero").trim().toLowerCase();
  const tenant = requireScrapeTenantConfig(tenantId);

  const deny = assertScrapeUrlAllowedForTenant(opts.url, tenant.domainWhitelist);
  if (deny) {
    return { ok: false, error: deny, url: opts.url };
  }

  return scrapeWithProvider({
    url: opts.url,
    reason: opts.reason,
    provider: opts.provider,
    timeoutMs: opts.timeoutMs,
    maxChars: opts.maxChars,
  });
}

/** @deprecated Gebruik `scrapeUrl({ tenant })`. */
export async function scrapeUrlViaJina(opts: {
  url: string;
  reason?: string;
  timeoutMs?: number;
  maxChars?: number;
}): Promise<ScrapeUrlResult> {
  return scrapeUrl({ ...opts, tenant: "fumero" });
}
