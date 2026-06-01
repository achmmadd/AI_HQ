/**
 * Jina Reader scrape voor Max (whitelist + veilige fetch).
 */

const JINA_READER_BASE = "https://r.jina.ai/";
const DEFAULT_TIMEOUT_MS = 25_000;
const DEFAULT_MAX_CHARS = 48_000;

/** Domeinen die Max via scrape_url mag ophalen. */
export const SCRAPE_URL_DOMAIN_WHITELIST = [
  "fumero.nl",
  "bigfarmers.nl",
  "hhcshop.nl",
  "nos.nl",
] as const;

export const FUMERO_KENNISBANK_REFRESH_PAGES = [
  "https://fumero.nl/shop/",
  "https://fumero.nl/contact/",
  "https://fumero.nl/betaalmethoden/",
  "https://fumero.nl/hhc-gebruikershandleiding/",
  "https://fumero.nl/product-category/hhc-vapes/",
  "https://fumero.nl/product-category/hhc-gummies/",
] as const;

export type ScrapeUrlResult =
  | {
      ok: true;
      url: string;
      markdown: string;
      truncated: boolean;
      fetchedAt: string;
    }
  | { ok: false; error: string; url?: string };

export function isJinaScrapeConfigured(): boolean {
  return Boolean(process.env.JINA_API_KEY?.trim());
}

export function normalizeScrapeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  try {
    const withProto = /^https?:\/\//i.test(t) ? t : `https://${t}`;
    const u = new URL(withProto);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

export function scrapeUrlHostnameAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return SCRAPE_URL_DOMAIN_WHITELIST.some(
    (d) => host === d || host.endsWith(`.${d}`)
  );
}

export function assertScrapeUrlAllowed(url: string): string | null {
  const normalized = normalizeScrapeUrl(url);
  if (!normalized) {
    return "Ongeldige URL. Gebruik een volledige https-link.";
  }
  let host: string;
  try {
    host = new URL(normalized).hostname;
  } catch {
    return "Ongeldige URL.";
  }
  if (!scrapeUrlHostnameAllowed(host)) {
    return `Domein niet toegestaan. Alleen: ${SCRAPE_URL_DOMAIN_WHITELIST.join(", ")}.`;
  }
  return null;
}

function jinaReaderUrl(targetUrl: string): string {
  const u = new URL(targetUrl);
  return `${JINA_READER_BASE}${u.protocol}//${u.host}${u.pathname}${u.search}`;
}

export async function scrapeUrlViaJina(opts: {
  url: string;
  reason?: string;
  timeoutMs?: number;
  maxChars?: number;
}): Promise<ScrapeUrlResult> {
  const deny = assertScrapeUrlAllowed(opts.url);
  if (deny) {
    return { ok: false, error: deny, url: opts.url };
  }

  const normalized = normalizeScrapeUrl(opts.url)!;
  const apiKey = process.env.JINA_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Jina Reader is niet geconfigureerd (JINA_API_KEY ontbreekt). Vraag een beheerder om de key in te stellen.",
      url: normalized,
    };
  }

  const reason = opts.reason?.trim() || "scrape_url";
  console.info("[scrape_url]", { url: normalized, reason });

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;

  try {
    const res = await fetch(jinaReaderUrl(normalized), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "text/markdown",
        "X-Return-Format": "markdown",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      const body = (await res.text()).slice(0, 400);
      return {
        ok: false,
        error: `Pagina ophalen mislukt (HTTP ${res.status}). ${body || "Probeer het later opnieuw."}`,
        url: normalized,
      };
    }

    let markdown = await res.text();
    const truncated = markdown.length > maxChars;
    if (truncated) {
      markdown = `${markdown.slice(0, maxChars)}\n\n… (inhoud ingekort voor chat)`;
    }

    return {
      ok: true,
      url: normalized,
      markdown: markdown.trim(),
      truncated,
      fetchedAt: new Date().toISOString(),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `Pagina ophalen mislukt: ${msg}`,
      url: normalized,
    };
  }
}

/** Deterministische numerieke id uit URL (Qdrant point-id basis). */
export function scrapeUrlDocumentId(url: string): number {
  const normalized = normalizeScrapeUrl(url) ?? url;
  let h = 0;
  for (let i = 0; i < normalized.length; i++) {
    h = (h * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return 900_000_000 + (h % 99_000_000);
}

export function chunkMarkdownForQdrant(
  markdown: string,
  chunkSize = 1800
): string[] {
  const text = markdown.trim();
  if (!text) return [];
  if (text.length <= chunkSize) return [text];

  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let buf = "";

  for (const p of paragraphs) {
    const piece = p.trim();
    if (!piece) continue;
    if ((buf + "\n\n" + piece).length <= chunkSize) {
      buf = buf ? `${buf}\n\n${piece}` : piece;
    } else {
      if (buf) chunks.push(buf);
      if (piece.length <= chunkSize) {
        buf = piece;
      } else {
        for (let i = 0; i < piece.length; i += chunkSize) {
          chunks.push(piece.slice(i, i + chunkSize));
        }
        buf = "";
      }
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}
