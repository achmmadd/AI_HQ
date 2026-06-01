import {
  DEFAULT_MAX_CHARS,
  normalizeScrapeUrl,
} from "@/lib/scrape/normalize";
import type { ScrapeUrlResult } from "@/lib/scrape/types";

const JINA_READER_BASE = "https://r.jina.ai/";
const DEFAULT_TIMEOUT_MS = 25_000;

export function isJinaScrapeConfigured(): boolean {
  return Boolean(process.env.JINA_API_KEY?.trim());
}

function jinaReaderUrl(targetUrl: string): string {
  const u = new URL(targetUrl);
  return `${JINA_READER_BASE}${u.protocol}//${u.host}${u.pathname}${u.search}`;
}

export async function scrapeViaJina(opts: {
  url: string;
  reason?: string;
  timeoutMs?: number;
  maxChars?: number;
}): Promise<ScrapeUrlResult> {
  const normalized = normalizeScrapeUrl(opts.url);
  if (!normalized) {
    return { ok: false, error: "Ongeldige URL.", url: opts.url };
  }

  const apiKey = process.env.JINA_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Jina Reader is niet geconfigureerd (JINA_API_KEY). Motor valt terug op native fetch als SCRAPE_PROVIDER=auto.",
      url: normalized,
    };
  }

  const reason = opts.reason?.trim() || "scrape_url";
  console.info("[scrape_url:jina]", { url: normalized, reason });

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
      provider: "jina",
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
