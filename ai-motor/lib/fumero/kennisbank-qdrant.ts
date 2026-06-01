import {
  kennisbankCollectionForTenant,
  upsertScrapedPageToKennisbank as upsertTenant,
} from "@/lib/scrape/kennisbank-upsert";
import type { ScrapeUrlResult } from "@/lib/scrape/types";

export function fumeroKennisbankCollection(): string {
  return kennisbankCollectionForTenant("fumero");
}

export async function upsertScrapedPageToKennisbank(opts: {
  scrape: Extract<ScrapeUrlResult, { ok: true }>;
  category?: string;
}): Promise<{ upserted: number; collection: string } | { error: string }> {
  return upsertTenant({
    tenant: "fumero",
    scrape: opts.scrape,
    category: opts.category,
  });
}
