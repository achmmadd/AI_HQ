import { scrapeUrl } from "@/lib/scrape/scrape-url";
import { upsertScrapedPageToKennisbank } from "@/lib/scrape/kennisbank-upsert";
import { requireScrapeTenantConfig } from "@/lib/scrape/tenants";
import type { ScrapeTenantId } from "@/lib/scrape/types";
import { sendTelegramMessage } from "@/lib/telegram";

export async function runTenantKennisbankRefresh(
  tenantId: ScrapeTenantId
): Promise<{ ok: boolean; detail: string }> {
  const tenant = requireScrapeTenantConfig(tenantId);
  const pages = tenant.kennisbankRefreshPages;

  if (!pages.length) {
    return {
      ok: false,
      detail: `Geen refresh-pagina's geconfigureerd voor ${tenant.displayName}.`,
    };
  }

  const scraped: string[] = [];
  const errors: string[] = [];
  let totalChunks = 0;

  for (const url of pages) {
    const result = await scrapeUrl({
      url,
      tenant: tenantId,
      reason: `kennisbank_refresh ${tenantId}`,
    });
    if (!result.ok) {
      errors.push(`${url}: ${result.error}`);
      continue;
    }

    const upsert = await upsertScrapedPageToKennisbank({
      tenant: tenantId,
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

  const notifyEnv =
    tenantId === "fumero"
      ? process.env.FUMERO_KENNISBANK_NOTIFY_MAX?.trim() !== "0"
      : process.env.BOKAS_KENNISBANK_NOTIFY_MAX?.trim() === "1";

  if (notifyEnv && scraped.length > 0) {
    void sendTelegramMessage(
      `📚 Kennisbank refresh ${tenant.displayName}\n${scraped.length} pagina's · ${totalChunks} chunks.\n` +
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
    `${scraped.length}/${pages.length} pagina's · ${totalChunks} chunks` +
    (errors.length ? ` · fouten: ${errors.join("; ")}` : "");

  return { ok: errors.length === 0, detail };
}
