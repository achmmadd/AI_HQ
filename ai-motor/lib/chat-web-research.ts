import {
  isAnthropicWebSearchConfigured,
  runAnthropicWebSearch,
} from "@/lib/anthropic-web-search";

const URL_RE = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

function extractUrlsFromText(text: string): string[] {
  const m = text.match(URL_RE);
  if (!m) return [];
  return [...new Set(m.map((u) => u.replace(/[),.]+$/g, "")))];
}

const RESEARCH_INTENT_RE =
  /\b(zoek\s+op|onderzoek|wat\s+is\s+de\s+(laatste|huidige|actuele)|nieuws\s+over|vergelijk|prijs\s+van|koers\s+van|recente\s+ontwikkelingen|live\s+info|op\s+internet|op\s+het\s+web|google\s+|web\s*search|bron(nen)?\s+voor|feiten\s+over)\b/i;

/** Normale chat: live webonderzoek (niet alleen builder). */
export function shouldRunChatWebResearch(prompt: string): boolean {
  if (process.env.MOTORS_CHAT_WEB_RESEARCH?.trim() === "0") return false;
  const t = prompt.trim();
  if (!t) return false;
  if (extractUrlsFromText(t).length > 0) return true;
  return RESEARCH_INTENT_RE.test(t);
}

async function fetchPageSnippet(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "MotorsAI-Chat/1.0 (+research)" },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("text/html") && !ct.includes("text/plain")) return null;
    const html = await res.text();
    const title =
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? url;
    const body = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2500);
    return `### ${title}\n${url}\n${body}`;
  } catch {
    return null;
  }
}

/**
 * Voert webonderzoek uit voor chat. Gebruikt Anthropic web_search indien mogelijk,
 * anders alleen meegegeven URLs ophalen.
 */
export async function runChatWebResearch(prompt: string): Promise<string> {
  const urls = extractUrlsFromText(prompt);
  const userLinks =
    urls.length > 0
      ? `\n\nGebruiker gaf deze links: ${urls.join(", ")}`
      : "";

  if (isAnthropicWebSearchConfigured()) {
    const research = await runAnthropicWebSearch({
      query: `Beantwoord deze vraag met actuele webbronnen. Citeer URLs waar mogelijk. Vraag: ${prompt.trim()}${userLinks}`,
      maxUses: 3,
    });
    if (research) {
      return `### Live webonderzoek (Anthropic)\n${research}`;
    }
  }

  if (urls.length === 0) return "";

  const snippets: string[] = [];
  for (const url of urls.slice(0, 3)) {
    const snip = await fetchPageSnippet(url);
    if (snip) snippets.push(snip);
  }
  if (!snippets.length) return "";
  return `### Pagina-inhoud (geen web_search key)\n${snippets.join("\n\n---\n\n")}`;
}
