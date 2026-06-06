import {
  assertScrapeUrlAllowedForTenant,
  normalizeScrapeUrl,
  scrapeUrlHostnameAllowed,
} from "@/lib/scrape/normalize";
import {
  looksLikeBroadSiteCheckRequest,
  looksLikeCasualScrapeRequest,
  looksLikeCasualSiteCheckFfRequest,
} from "@/lib/fumero/casual-prompt";
import { requireScrapeTenantConfig } from "@/lib/scrape/tenants";
import type { ScrapeTenantId } from "@/lib/scrape/types";

const URL_RE = /https?:\/\/[^\s<>"{}|\\^`\[\])]+/gi;

const EXPLICIT_SCRAPE_RE =
  /(?:^|\s)scrape_url\s*:\s*(https?:\/\/\S+|[^\s]+\.nl[^\s]*)/i;

const EXPLICIT_JINA_RE =
  /(?:^|\s)jina\s*\(\s*(https?:\/\/[^)\s]+|[^)\s]+\.nl[^)\s]*)\s*\)/i;

const BARE_DOMAIN_RE =
  /\b((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:nl|com|eu|net|org))\b/gi;

/** fumero.nl/pad of https://fumero.nl/pad — zonder spaties. */
const BARE_SITE_URL_RE =
  /\b(?:https?:\/\/)?(?:www\.)?((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:nl|com|eu|net|org)(?:\/[^\s<>"{}|\\^`\[\])]+)?)/gi;

const KENNISBANK_INTENT_RE =
  /\b(kennisbank|faq|veel\s*gestelde|veel-gestelde|vragenpagina)\b/i;

const SCRAPE_INTENT_RE =
  /\b(scrape|scrapen|scrape_url|jina\s*\(|haal\s+(?:de\s+)?(?:info|informatie)|pak\s+(?:de\s+)?info|ophalen|live\s+info|alle\s+(?:benodigde\s+)?info|benodigde\s+info|website\s*info|inhoud\s+van|van\s+de\s+site|onze\s+site|die\s+site|lees\s+(?:even\s+)?(?:de\s+)?site|info\s+van\s+fumero|wat\s+op\s+(?:de\s+)?site\s+staat)\b/i;

const LIVE_PAGE_INTENT_RE =
  /\b(check|bekijk|lees|actuele|live|prijzen|pagina|webshop|voorraad|wat\s+staat\s+er|op\s+de\s+site|check\s+ff|ff\s+check|kijk\s+ff|site\s+ff|even\s+checken)\b/i;

const BROAD_SITE_RE =
  /\b(alle\s+(?:benodigde\s+)?info|benodigde\s+info|hele\s+(?:site|website|webshop)|volledige\s+site|complete\s+site|uit\s+(?:de\s+)?site|alles\s+van\s+fumero|site\s*check|check\s+(?:de\s+)?(?:hele\s+)?site|check\s+ff|ff\s+check|kijk\s+ff|site\s+ff|even\s+checken|voor\s+(?:de\s+)?chatbot|chatbot\s+(?:te\s+)?bouwen|om\s+(?:de\s+)?chatbot|voor\s+chatbot|hele\s+fumero)\b/i;

const FUMERO_SITE_HINT_RE =
  /\b(fumero\.nl|fumero|onze\s+(?:site|website|shop|webshop)|de\s+(?:site|website|webshop))\b/i;

const BROAD_SITE_PAGE_CAP = 8;
const DEFAULT_CHAT_PAGE_CAP = 3;
const DEFAULT_BUILD_PAGE_CAP = 5;

function stripTrailingUrlPunctuation(url: string): string {
  return url.replace(/[),.\]]+$/g, "").trim();
}

function extractUrlsFromText(text: string): string[] {
  const m = text.match(URL_RE);
  if (!m) return [];
  return [
    ...new Set(
      m.map((u) => stripTrailingUrlPunctuation(u)).filter(Boolean)
    ),
  ];
}

/** Domein + pad zonder protocol (bv. fumero.nl/veel-gestelde-vragen/). */
export function extractBareSiteUrlsFromText(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(BARE_SITE_URL_RE)) {
    const raw = stripTrailingUrlPunctuation(m[0] ?? "");
    const normalized = normalizeScrapeUrl(raw);
    if (normalized && !out.includes(normalized)) out.push(normalized);
  }
  return out;
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
  const candidates = [
    ...extractUrlsFromText(prompt),
    ...extractBareSiteUrlsFromText(prompt),
  ];
  const out: string[] = [];
  for (const u of candidates) {
    if (assertScrapeUrlAllowedForTenant(u, whitelist)) continue;
    const n = normalizeScrapeUrl(u);
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

function hasExplicitPathInPrompt(prompt: string): boolean {
  return extractBareSiteUrlsFromText(prompt).some((u) => {
    try {
      const path = new URL(u).pathname;
      return path.length > 1;
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
  const home = `https://${domain}/`;
  const fromConfig = tenant.kennisbankRefreshPages.filter((u) => {
    try {
      const h = new URL(u).hostname.toLowerCase().replace(/^www\./, "");
      return h === domain || h.endsWith(`.${domain}`);
    } catch {
      return false;
    }
  });
  if (fromConfig.length) {
    return [home, ...fromConfig.filter((u) => u !== home)];
  }
  return [home, `https://${domain}/shop/`];
}

/** Brede site-check / hele site / chatbot-voorbereiding. */
export function isBroadSiteScrapeIntent(prompt: string): boolean {
  const t = prompt.trim();
  if (!t) return false;
  return (
    BROAD_SITE_RE.test(t) ||
    looksLikeBroadSiteCheckRequest(t) ||
    looksLikeCasualSiteCheckFfRequest(t)
  );
}

export function resolveScrapePageLimit(
  prompt: string,
  opts?: { buildIntent?: boolean }
): number {
  if (isBroadSiteScrapeIntent(prompt)) return BROAD_SITE_PAGE_CAP;
  return opts?.buildIntent ? DEFAULT_BUILD_PAGE_CAP : DEFAULT_CHAT_PAGE_CAP;
}

function primaryDomainForTenant(tenantId: ScrapeTenantId): string {
  const tenant = requireScrapeTenantConfig(tenantId);
  return tenant.domainWhitelist[0] ?? "fumero.nl";
}

export function shouldScrapeFromPrompt(
  prompt: string,
  tenantId: ScrapeTenantId = "fumero"
): boolean {
  const tenant = requireScrapeTenantConfig(tenantId);
  if (extractExplicitScrapeUrl(prompt)) return true;
  if (looksLikeCasualScrapeRequest(prompt)) return true;
  if (looksLikeCasualSiteCheckFfRequest(prompt) && tenantId === "fumero") {
    return true;
  }
  if (
    isBroadSiteScrapeIntent(prompt) &&
    (tenantId === "fumero" || FUMERO_SITE_HINT_RE.test(prompt))
  ) {
    return true;
  }

  const urls = whitelistedUrlsInPrompt(prompt, tenant.domainWhitelist);
  const domains = bareDomainsInPrompt(prompt, tenant.domainWhitelist);

  if (SCRAPE_INTENT_RE.test(prompt) && (urls.length > 0 || domains.length > 0)) {
    return true;
  }
  if (urls.length > 0 && LIVE_PAGE_INTENT_RE.test(prompt)) return true;
  if (domains.length > 0 && BROAD_SITE_RE.test(prompt)) return true;
  if (
    (urls.length > 0 || domains.length > 0) &&
    KENNISBANK_INTENT_RE.test(prompt)
  ) {
    return true;
  }

  return false;
}

/** Maximaal aantal pagina's per request (chat vs bouwen). */
export function resolveScrapeTargets(
  prompt: string,
  tenantId: ScrapeTenantId = "fumero",
  opts?: { maxPages?: number }
): string[] {
  const tenant = requireScrapeTenantConfig(tenantId);
  const broad = isBroadSiteScrapeIntent(prompt);
  const maxPages =
    opts?.maxPages ?? resolveScrapePageLimit(prompt, { buildIntent: broad });

  const explicit = extractExplicitScrapeUrl(prompt);
  if (explicit && assertScrapeUrlAllowedForTenant(explicit, tenant.domainWhitelist) === null) {
    return [explicit];
  }

  let urls = whitelistedUrlsInPrompt(prompt, tenant.domainWhitelist);
  const domains = bareDomainsInPrompt(prompt, tenant.domainWhitelist);
  const explicitPath = hasExplicitPathInPrompt(prompt);

  if (!urls.length && !domains.length && broad && tenantId === "fumero") {
    urls = defaultPagesForDomain(tenantId, primaryDomainForTenant(tenantId));
  }

  if (!urls.length && domains.length) {
    const domain = domains[0];
    if ((broad || SCRAPE_INTENT_RE.test(prompt)) && !explicitPath) {
      urls = defaultPagesForDomain(tenantId, domain);
    } else {
      urls = [`https://${domain}/`];
    }
  } else if (
    !explicitPath &&
    (broad ||
      (urls.length >= 1 &&
        (/\bchatbot\b/i.test(prompt) || SCRAPE_INTENT_RE.test(prompt))))
  ) {
    const host = domains[0]
      ? domains[0]
      : urls.length
        ? new URL(urls[0]).hostname.replace(/^www\./, "")
        : primaryDomainForTenant(tenantId);
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
