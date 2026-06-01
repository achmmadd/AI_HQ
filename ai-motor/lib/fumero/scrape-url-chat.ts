import { buildScrapeContextForPrompt } from "@/lib/scrape/build-scrape-context";
import { shouldScrapeFromPrompt } from "@/lib/scrape/resolve-scrape-targets";

export { shouldScrapeFromPrompt as shouldScrapeUrlsForMaxChat } from "@/lib/scrape/resolve-scrape-targets";
export { buildScrapeContextForToolBuild } from "@/lib/scrape/build-scrape-context";

/**
 * Chat-context voor Max (geen wijziging aan /api/chat/stream).
 */
export async function buildScrapeUrlChatContext(
  userPrompt: string
): Promise<string> {
  const result = await buildScrapeContextForPrompt(userPrompt, "fumero", {
    maxPages: 3,
  });
  if (!result?.block) return "";
  return result.block;
}
