import {
  scrapePageDoneLabel,
  scrapePageStepLabel,
  scrapePlanStepLabel,
  scrapeProviderStepLabel,
} from "@/lib/fumero/fumero-live-steps";
import { scrapeUrl } from "@/lib/scrape/scrape-url";
import {
  resolveScrapePageLimit,
  resolveScrapeTargets,
  shouldScrapeFromPrompt,
} from "@/lib/scrape/resolve-scrape-targets";
import type { ScrapeTenantId } from "@/lib/scrape/types";

export type ScrapeProgressCallback = (label: string) => void;

const MAX_TOOL_BUILD_SCRAPE_CHARS = 28_000;

export type ScrapeContextResult = {
  block: string;
  urls: string[];
  errors: string[];
};

/**
 * Haalt live pagina-inhoud op voor chat of tool-build.
 */
export async function buildScrapeContextForPrompt(
  userPrompt: string,
  tenantId: ScrapeTenantId = "fumero",
  opts?: {
    maxPages?: number;
    maxTotalChars?: number;
    reason?: string;
    onProgress?: ScrapeProgressCallback;
  }
): Promise<ScrapeContextResult | null> {
  if (!shouldScrapeFromPrompt(userPrompt, tenantId)) {
    return null;
  }

  const urls = resolveScrapeTargets(userPrompt, tenantId, {
    maxPages: opts?.maxPages ?? resolveScrapePageLimit(userPrompt),
  });
  if (!urls.length) return null;

  const report = opts?.onProgress;
  report?.(scrapePlanStepLabel(urls.length));
  report?.(scrapeProviderStepLabel());

  const maxTotal = opts?.maxTotalChars ?? MAX_TOOL_BUILD_SCRAPE_CHARS;
  const blocks: string[] = [];
  const errors: string[] = [];
  let usedChars = 0;

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    report?.(scrapePageStepLabel(i + 1, urls.length, url));
    const result = await scrapeUrl({
      url,
      tenant: tenantId,
      reason: opts?.reason ?? "scrape context",
    });
    if (!result.ok) {
      errors.push(`${url}: ${result.error}`);
      report?.(
        scrapePageDoneLabel(url, { ok: false, error: result.error })
      );
      continue;
    }
    let md = result.markdown;
    const room = maxTotal - usedChars;
    if (room <= 0) break;
    if (md.length > room) {
      md = `${md.slice(0, room)}\n\n… (ingekort)`;
    }
    usedChars += md.length;
    blocks.push(
      `### ${result.url} (${result.provider})\n${md}`
    );
    report?.(
      scrapePageDoneLabel(result.url, { ok: true, charCount: md.length })
    );
    if (usedChars >= maxTotal) break;
  }

  if (!blocks.length) {
    report?.("Geen pagina-inhoud opgehaald — ga door met beschikbare context…");
    return { block: "", urls, errors };
  }

  report?.("Live site-data klaar — antwoord voorbereiden…");

  const block = [
    "--- LIVE PAGINA (gebruik als bron voor je antwoord of tool — niet letterlijk dumpen) ---",
    blocks.join("\n\n---\n\n"),
    "--- EINDE LIVE PAGINA ---",
    "",
  ].join("\n");

  return { block, urls, errors };
}

/** Voor Bouwen: meer pagina's, grotere context. */
export async function buildScrapeContextForToolBuild(
  userPrompt: string,
  tenantId: ScrapeTenantId = "fumero"
): Promise<ScrapeContextResult | null> {
  return buildScrapeContextForPrompt(userPrompt, tenantId, {
    maxPages: resolveScrapePageLimit(userPrompt, { buildIntent: true }),
    maxTotalChars: MAX_TOOL_BUILD_SCRAPE_CHARS,
    reason: "tool build context",
  });
}
