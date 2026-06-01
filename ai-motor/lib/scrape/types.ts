/** Provider die een URL omzet naar leesbare tekst voor Max / kennisbank. */
export type ScrapeProviderId = "jina" | "native";

export type ScrapeUrlResult =
  | {
      ok: true;
      url: string;
      markdown: string;
      truncated: boolean;
      fetchedAt: string;
      provider: ScrapeProviderId;
    }
  | { ok: false; error: string; url?: string };

export type ScrapeTenantId = string;

export type ScrapeTenantConfig = {
  id: ScrapeTenantId;
  displayName: string;
  /** Hostnames (zonder www) die deze tenant mag scrapen. */
  domainWhitelist: readonly string[];
  /** Vaste pagina's voor geplande kennisbank-refresh (cron). */
  kennisbankRefreshPages: readonly string[];
  /**
   * Qdrant-collectie voor web-scrapes.
   * Leeg → `qdrantCollectionForScope(tenant)` + optioneel suffix.
   */
  kennisbankCollection?: string;
};
