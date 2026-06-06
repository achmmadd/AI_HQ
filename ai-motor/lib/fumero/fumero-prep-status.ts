import { isFumeroSiteCheckChatIntent } from "@/lib/fumero/casual-prompt";
import { shouldScrapeFromPrompt } from "@/lib/scrape/resolve-scrape-targets";

/** Eerste concrete stap direct na versturen (geen generiek "denkt na"). */
export function fumeroPrepStatusLabel(prompt: string): string {
  if (
    shouldScrapeFromPrompt(prompt, "fumero") ||
    isFumeroSiteCheckChatIntent(prompt)
  ) {
    return "Site-check voorbereiden…";
  }
  return "Opdracht verwerken…";
}
