import {
  FUMERO_KENNISBANK_REFRESH_PAGES,
  scrapeUrlViaJina,
} from "@/lib/fumero/scrape-url";
import { upsertScrapedPageToKennisbank } from "@/lib/fumero/kennisbank-qdrant";
import { sendTelegramMessage } from "@/lib/telegram";

export async function runFumeroKennisbankRefresh(): Promise<{
  ok: boolean;
  detail: string;
}> {
  const scraped: string[] = [];
  const errors: string[] = [];
  let totalChunks = 0;

  for (const url of FUMERO_KENNISBANK_REFRESH_PAGES) {
    const result = await scrapeUrlViaJina({
      url,
      reason: "kennisbank_refresh weekly",
    });
    if (!result.ok) {
      errors.push(`${url}: ${result.error}`);
      continue;
    }

    const upsert = await upsertScrapedPageToKennisbank({
      scrape: result,
      category: "kennisbank_refresh",
    });
    if ("error" in upsert) {
      errors.push(`${url}: ${upsert.error}`);
      continue;
    }

    scraped.push(url);
    totalChunks += upsert.upserted;
  }

  const notifyMax = process.env.FUMERO_KENNISBANK_NOTIFY_MAX?.trim() !== "0";
  if (notifyMax && scraped.length > 0) {
    void sendTelegramMessage(
      `📚 Kennisbank refresh Fumero\n${scraped.length} pagina's bijgewerkt · ${totalChunks} chunks in Qdrant.\n` +
        scraped.map((u) => `· ${u}`).join("\n")
    );
  }

  if (!scraped.length) {
    return {
      ok: false,
      detail: errors.length
        ? errors.join(" | ")
        : "Geen pagina's gescraped.",
    };
  }

  const detail =
    `${scraped.length}/${FUMERO_KENNISBANK_REFRESH_PAGES.length} pagina's · ${totalChunks} chunks` +
    (errors.length ? ` · fouten: ${errors.join("; ")}` : "");

  return { ok: errors.length === 0, detail };
}
