import { scrapeViaJina, isJinaScrapeConfigured } from "@/lib/scrape/providers/jina";
import { scrapeViaNativeFetch } from "@/lib/scrape/providers/native";
import type { ScrapeProviderId } from "@/lib/scrape/types";

export type ScrapeProviderMode = "auto" | ScrapeProviderId;

export function getScrapeProviderMode(): ScrapeProviderMode {
  const raw = (process.env.SCRAPE_PROVIDER || "auto").trim().toLowerCase();
  if (raw === "jina" || raw === "native") return raw;
  return "auto";
}

export function isScrapeConfigured(): boolean {
  const mode = getScrapeProviderMode();
  if (mode === "native") return true;
  if (mode === "jina") return isJinaScrapeConfigured();
  return true;
}

export function activeScrapeProviderLabel(): string {
  const mode = getScrapeProviderMode();
  if (mode === "jina") return "jina";
  if (mode === "native") return "native";
  return isJinaScrapeConfigured() ? "jina (auto)" : "native (auto)";
}

/**
 * Long-term: één ingest-pad voor alle tenants.
 * auto = Jina indien key, anders native (geen extra vendor lock-in).
 */
export async function scrapeWithProvider(opts: {
  url: string;
  reason?: string;
  provider?: ScrapeProviderMode;
  timeoutMs?: number;
  maxChars?: number;
}): Promise<
  Awaited<ReturnType<typeof scrapeViaJina>>
> {
  const mode = opts.provider ?? getScrapeProviderMode();

  if (mode === "native") {
    return scrapeViaNativeFetch(opts);
  }

  if (mode === "jina") {
    return scrapeViaJina(opts);
  }

  if (isJinaScrapeConfigured()) {
    const jina = await scrapeViaJina(opts);
    if (jina.ok) return jina;
    console.warn("[scrape_url] Jina mislukt, fallback native:", jina.error);
  }

  return scrapeViaNativeFetch(opts);
}
