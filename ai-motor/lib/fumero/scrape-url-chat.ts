import {
  assertScrapeUrlAllowed,
  normalizeScrapeUrl,
  scrapeUrl,
  scrapeUrlHostnameAllowed,
} from "@/lib/fumero/scrape-url";

const URL_RE = /https?:\/\/[^\s<>"{}|\\^`\[\])]+/gi;

const EXPLICIT_SCRAPE_RE =
  /(?:^|\s)scrape_url\s*:\s*(https?:\/\/\S+|[^\s]+\.nl[^\s]*)/i;

const LIVE_PAGE_INTENT_RE =
  /\b(check|bekijk|lees|actuele|live|prijzen|pagina|webshop|voorraad|wat\s+staat\s+er|inhoud\s+van|op\s+de\s+site)\b/i;

function extractUrlsFromText(text: string): string[] {
  const m = text.match(URL_RE);
  if (!m) return [];
  return [
    ...new Set(
      m.map((u) => u.replace(/[),.\]]+$/g, "").trim()).filter(Boolean)
    ),
  ];
}

function extractExplicitScrapeUrl(prompt: string): string | null {
  const m = prompt.match(EXPLICIT_SCRAPE_RE);
  if (!m?.[1]) return null;
  return normalizeScrapeUrl(m[1]);
}

function whitelistedUrlsInPrompt(prompt: string): string[] {
  const urls = extractUrlsFromText(prompt);
  return urls.filter((u) => {
    try {
      return scrapeUrlHostnameAllowed(new URL(u).hostname);
    } catch {
      return false;
    }
  });
}

export function shouldScrapeUrlsForMaxChat(prompt: string): boolean {
  if (extractExplicitScrapeUrl(prompt)) return true;
  const whitelisted = whitelistedUrlsInPrompt(prompt);
  if (!whitelisted.length) return false;
  return LIVE_PAGE_INTENT_RE.test(prompt);
}

/**
 * Haalt whitelist-URLs uit de gebruikersprompt op via Jina en geeft een contextblok
 * terug voor Max (geen wijziging aan /api/chat/stream).
 */
export async function buildScrapeUrlChatContext(
  userPrompt: string
): Promise<string> {
  if (!shouldScrapeUrlsForMaxChat(userPrompt)) return "";

  const explicit = extractExplicitScrapeUrl(userPrompt);
  let urls = explicit ? [explicit] : whitelistedUrlsInPrompt(userPrompt);
  if (!urls.length) return "";

  urls = urls.slice(0, 3);
  const blocks: string[] = [];

  for (const url of urls) {
    if (assertScrapeUrlAllowed(url)) continue;
    const reason = explicit
      ? "explicit scrape_url command"
      : "live page check in chat";
    const result = await scrapeUrl({ url, tenant: "fumero", reason });
    if (!result.ok) {
      blocks.push(`### ${url}\nFout: ${result.error}`);
      continue;
    }
    blocks.push(
      `### Live pagina (${result.url})\nGescraped: ${result.fetchedAt}${result.truncated ? " · ingekort" : ""}\n\n${result.markdown}`
    );
  }

  if (!blocks.length) return "";

  return [
    "--- LIVE PAGINA (scrape_url — gebruik voor je antwoord, niet letterlijk dumpen) ---",
    blocks.join("\n\n---\n\n"),
    "--- EINDE LIVE PAGINA ---",
    "",
  ].join("\n");
}
