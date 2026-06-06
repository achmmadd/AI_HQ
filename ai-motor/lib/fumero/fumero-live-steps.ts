import { activeScrapeProviderLabel } from "@/lib/scrape/scrape-url";

/** Kort pad voor UI (fumero.nl/shop). */
export function shortScrapeUrlLabel(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/$/, "") || "/";
    if (path === "/") return u.hostname.replace(/^www\./, "");
    return `${u.hostname.replace(/^www\./, "")}${path}`;
  } catch {
    return url.slice(0, 48);
  }
}

export function scrapeProviderStepLabel(): string {
  const reader = activeScrapeProviderLabel();
  return reader && reader !== "niet geconfigureerd"
    ? `Live inhoud ophalen (${reader})…`
    : "Live inhoud ophalen…";
}

export function scrapePlanStepLabel(pageCount: number): string {
  return pageCount === 1
    ? "Site-check: 1 pagina…"
    : `Site-check: ${pageCount} pagina's…`;
}

export function scrapePageStepLabel(index: number, total: number, url: string): string {
  return `Pagina ${index}/${total}: ${shortScrapeUrlLabel(url)}…`;
}

export function scrapePageDoneLabel(
  url: string,
  opts: { ok: boolean; charCount?: number; error?: string }
): string {
  const where = shortScrapeUrlLabel(url);
  if (!opts.ok) {
    const err = opts.error?.trim().slice(0, 60) ?? "mislukt";
    return `✗ ${where} — ${err}`;
  }
  if (opts.charCount != null && opts.charCount > 0) {
    return `✓ ${where} (${opts.charCount.toLocaleString("nl-NL")} tekens)`;
  }
  return `✓ ${where}`;
}

export function fumeroStuckHintLabel(lastStep: string): string {
  const step = lastStep.trim() || "bezig";
  return `Nog bezig… (${step})`;
}
