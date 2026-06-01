import {
  assertScrapeUrlAllowedForTenant,
  normalizeScrapeUrl,
  scrapeUrlHostnameAllowed,
} from "@/lib/scrape/normalize";
import { requireScrapeTenantConfig } from "@/lib/scrape/tenants";
import type { ScrapeTenantId } from "@/lib/scrape/types";

const URL_RE = /https?:\/\/[^\s<>"{}|\\^`\[\])]+/gi;

const EXPLICIT_SCRAPE_RE =
  /(?:^|\s)scrape_url\s*:\s*(https?:\/\/\S+|[^\s]+\.nl[^\s]*)/i;

const EXPLICIT_JINA_RE =
  /(?:^|\s)jina\s*\(\s*(https?:\/\/[^)\s]+|[^)\s]+\.nl[^)\s]*)\s*\)/i;

const BARE_DOMAIN_RE =
  /\b((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:nl|com|eu|net|org))\b/gi;

const SCRAPE_INTENT_RE =
  /\b(scrape|scrapen|scrape_url|jina\s*\(|haal\s+(?:de\s+)?(?:info|informatie)|ophalen|live\s+info|alle\s+(?:benodigde\s+)?info|benodigde\s+info|website\s*info|inhoud\s+van|van\s+de\s+site)\b/i;

const LIVE_PAGE_INTENT_RE =
  /\b(check|bekijk|lees|actuele|live|prijzen|pagina|webshop|voorraad|wat\s+staat\s+er|op\s+de\s+site)\b/i;

const BROAD_SITE_RE =
  /\b(alle\s+(?:benodigde\s+)?info|benodigde\s+info|hele\s+(?:site|website)|volledige\s+site|uit\s+(?:de\s+)?site|voor\s+(?:de\s+)?chatbot|chatbot\s+(?:te\s+)?bouwen|om\s+(?:de\s+)?chatbot)\b/i;

function extractUrlsFromText(text: string): string[] {
  const m = text.match(URL_RE);
  if (!m) return [];
  return [
    ...new Set(
      m.map((u) => u.replace(/[),.\]]+$/g, "").trim()).filter(Boolean)
    ),
  ];
}

export function extractExplicitScrapeUrl(prompt: string): string | null {
  const m = prompt.match(EXPLICIT_SCRAPE_RE);
  if (m?.[1]) return normalizeScrapeUrl(m[1]);
  const j = prompt.match(EXPLICIT_JINA_RE);
  if (j?.[1]) return normalizeScrapeUrl(j[1]);
  return null;
}

function whitelistedUrlsInPrompt(
  prompt: string,
  whitelist: readonly string[]
): string[] {
  return extractUrlsFromText(prompt).filter((u) => {
    try {
      return scrapeUrlHostnameAllowed(new URL(u).hostname, whitelist);
    } catch {
      return false;
    }
  });
}

function bareDomainsInPrompt(
  prompt: string,
  whitelist: readonly string[]
): string[] {
  const found = new Set<string>();
  for (const m of prompt.matchAll(BARE_DOMAIN_RE)) {
    const d = m[1]?.toLowerCase().replace(/^www\./, "");
    if (!d) continue;
    if (whitelist.some((w) => d === w || d.endsWith(`.${w}`))) {
      found.add(d);
    }
  }
  return [...found];
}

function defaultPagesForDomain(
  tenantId: ScrapeTenantId,
  domain: string
): string[] {
  const tenant = requireScrapeTenantConfig(tenantId);
  const fromConfig = tenant.kennisbankRefreshPages.filter((u) => {
    try {
      const h = new URL(u).hostname.toLowerCase().replace(/^www\./, "");
      return h === domain || h.endsWith(`.${domain}`);
    } catch {
      return false;
    }
  });
  if (fromConfig.length) return fromConfig;
  return [`https://${domain}/`, `https://${domain}/shop/`];
}

export function shouldScrapeFromPrompt(
  prompt: string,
  tenantId: ScrapeTenantId = "fumero"
): boolean {
  const tenant = requireScrapeTenantConfig(tenantId);
  if (extractExplicitScrapeUrl(prompt)) return true;

  const urls = whitelistedUrlsInPrompt(prompt, tenant.domainWhitelist);
  const domains = bareDomainsInPrompt(prompt, tenant.domainWhitelist);

  if (SCRAPE_INTENT_RE.test(prompt) && (urls.length > 0 || domains.length > 0)) {
    return true;
  }
  if (urls.length > 0 && LIVE_PAGE_INTENT_RE.test(prompt)) return true;
  if (domains.length > 0 && BROAD_SITE_RE.test(prompt)) return true;

  return false;
}

/** Maximaal aantal pagina's per request (chat vs bouwen). */
export function resolveScrapeTargets(
  prompt: string,
  tenantId: ScrapeTenantId = "fumero",
  opts?: { maxPages?: number }
): string[] {
  const tenant = requireScrapeTenantConfig(tenantId);
  const maxPages = opts?.maxPages ?? 3;

  const explicit = extractExplicitScrapeUrl(prompt);
  if (explicit && assertScrapeUrlAllowedForTenant(explicit, tenant.domainWhitelist) === null) {
    return [explicit];
  }

  let urls = whitelistedUrlsInPrompt(prompt, tenant.domainWhitelist);
  const domains = bareDomainsInPrompt(prompt, tenant.domainWhitelist);

  if (!urls.length && domains.length) {
    const domain = domains[0];
    if (BROAD_SITE_RE.test(prompt) || SCRAPE_INTENT_RE.test(prompt)) {
      urls = defaultPagesForDomain(tenantId, domain);
    } else {
      urls = [`https://${domain}/`];
    }
  } else if (
    urls.length === 1 &&
    (BROAD_SITE_RE.test(prompt) || /\bchatbot\b/i.test(prompt)) &&
    SCRAPE_INTENT_RE.test(prompt)
  ) {
    const host = new URL(urls[0]).hostname.replace(/^www\./, "");
    const extra = defaultPagesForDomain(tenantId, host);
    urls = [...new Set([...urls, ...extra])];
  }

  const out: string[] = [];
  for (const u of urls) {
    if (assertScrapeUrlAllowedForTenant(u, tenant.domainWhitelist)) continue;
    const n = normalizeScrapeUrl(u);
    if (n && !out.includes(n)) out.push(n);
    if (out.length >= maxPages) break;
  }
  return out;
}
