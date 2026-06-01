import {
  DEFAULT_MAX_CHARS,
  normalizeScrapeUrl,
} from "@/lib/scrape/normalize";
import type { ScrapeUrlResult } from "@/lib/scrape/types";

const DEFAULT_TIMEOUT_MS = 20_000;

/** HTML → leesbare tekst (geen externe API; geschikt als fallback / dev). */
function htmlToReadableText(html: string, url: string): string {
  const title =
    html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? url;
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return `# ${title}\n\nBron: ${url}\n\n${body}`;
}

/**
 * Directe HTTP-fetch — altijd beschikbaar, minder kwaliteit dan Jina op JS-heavy sites.
 */
export async function scrapeViaNativeFetch(opts: {
  url: string;
  reason?: string;
  timeoutMs?: number;
  maxChars?: number;
}): Promise<ScrapeUrlResult> {
  const normalized = normalizeScrapeUrl(opts.url);
  if (!normalized) {
    return { ok: false, error: "Ongeldige URL.", url: opts.url };
  }

  const reason = opts.reason?.trim() || "scrape_url";
  console.info("[scrape_url:native]", { url: normalized, reason });

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxChars = opts.maxChars ?? DEFAULT_MAX_CHARS;

  try {
    const res = await fetch(normalized, {
      headers: {
        "User-Agent": "MotorsAI-UrlReader/1.0 (+tenant scrape)",
        Accept: "text/html,application/xhtml+xml,text/plain",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) {
      return {
        ok: false,
        error: `Pagina ophalen mislukt (HTTP ${res.status}).`,
        url: normalized,
      };
    }

    const ct = res.headers.get("content-type") ?? "";
    const raw = await res.text();

    let markdown: string;
    if (ct.includes("text/html") || raw.trimStart().startsWith("<")) {
      markdown = htmlToReadableText(raw, normalized);
    } else {
      markdown = `# ${normalized}\n\n${raw.trim()}`;
    }

    const truncated = markdown.length > maxChars;
    if (truncated) {
      markdown = `${markdown.slice(0, maxChars)}\n\n… (inhoud ingekort)`;
    }

    return {
      ok: true,
      url: normalized,
      markdown: markdown.trim(),
      truncated,
      fetchedAt: new Date().toISOString(),
      provider: "native",
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
