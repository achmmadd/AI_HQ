const DEFAULT_MAX_CHARS = 48_000;

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

export function scrapeUrlHostnameAllowed(
  hostname: string,
  whitelist: readonly string[]
): boolean {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return whitelist.some((d) => host === d || host.endsWith(`.${d}`));
}

export function assertScrapeUrlAllowedForTenant(
  url: string,
  whitelist: readonly string[]
): string | null {
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
  if (!scrapeUrlHostnameAllowed(host, whitelist)) {
    return `Domein niet toegestaan voor deze workspace. Toegestaan: ${whitelist.join(", ")}.`;
  }
  return null;
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

export { DEFAULT_MAX_CHARS };
