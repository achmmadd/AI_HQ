import { scrapeUrl } from "@/lib/scrape/scrape-url";
import {
  resolveScrapeTargets,
  shouldScrapeFromPrompt,
} from "@/lib/scrape/resolve-scrape-targets";
import type { ScrapeTenantId } from "@/lib/scrape/types";

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
  opts?: { maxPages?: number; maxTotalChars?: number; reason?: string }
): Promise<ScrapeContextResult | null> {
  if (!shouldScrapeFromPrompt(userPrompt, tenantId)) {
    return null;
  }

  const urls = resolveScrapeTargets(userPrompt, tenantId, {
    maxPages: opts?.maxPages ?? 3,
  });
  if (!urls.length) return null;

  const maxTotal = opts?.maxTotalChars ?? MAX_TOOL_BUILD_SCRAPE_CHARS;
  const blocks: string[] = [];
  const errors: string[] = [];
  let usedChars = 0;

  for (const url of urls) {
    const result = await scrapeUrl({
      url,
      tenant: tenantId,
      reason: opts?.reason ?? "scrape context",
    });
    if (!result.ok) {
      errors.push(`${url}: ${result.error}`);
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
    if (usedChars >= maxTotal) break;
  }

  if (!blocks.length) {
    return { block: "", urls, errors };
  }

  const block = [
    "--- LIVE WEBSITE-INHOUD (gebruik als bron voor je antwoord of tool — niet letterlijk dumpen) ---",
    blocks.join("\n\n---\n\n"),
    "--- EINDE LIVE WEBSITE-INHOUD ---",
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
    maxPages: 5,
    maxTotalChars: MAX_TOOL_BUILD_SCRAPE_CHARS,
    reason: "tool build context",
  });
}
