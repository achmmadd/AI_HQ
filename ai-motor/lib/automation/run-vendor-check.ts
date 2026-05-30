import db from "@/lib/db/database";
import { searchKnowledge } from "@/lib/knowledge-service";
import { sendTelegramMessage } from "@/lib/telegram";
import { withBrowser } from "@/lib/automation/playwright-browser";

function normalizeTitle(s: string): string {
  return s.replace(/\s+/g, " ").trim().slice(0, 500);
}

export async function runVendorCheckWeekly(): Promise<{
  ok: boolean;
  detail: string;
}> {
  const urlsRaw = process.env.VENDOR_CATALOG_URLS?.trim();
  if (!urlsRaw) {
    return {
      ok: false,
      detail:
        "VENDOR_CATALOG_URLS ontbreekt (komma-gescheiden URLs van leverancierscatalogi).",
    };
  }

  const urls = urlsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const titleSel =
    process.env.VENDOR_PRODUCT_TITLE_SEL?.trim() ||
    ".woocommerce-loop-product__title, .product-title a, h2.woocommerce-loop-product__title, .product .title, [data-product_name]";

  const ins = db.prepare(
    `INSERT OR IGNORE INTO vendor_catalog_snapshot (vendor_key, product_title)
     VALUES (?, ?)`
  );

  let newProducts = 0;
  let notInKb = 0;
  const errors: string[] = [];

  for (const url of urls) {
    let vendorKey: string;
    try {
      vendorKey = new URL(url).hostname;
    } catch {
      errors.push(`Ongeldige URL: ${url}`);
      continue;
    }

    try {
      const titles = await withBrowser(async (context) => {
        const page = await context.newPage();
        await page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: 90_000,
        });
        return page.$$eval(
          titleSel,
          (els) =>
            els
              .map((e) => e.textContent?.trim() || "")
              .filter((t) => t.length > 2)
        );
      });

      const seen = new Set<string>();
      for (const raw of titles) {
        const title = normalizeTitle(raw);
        if (!title || seen.has(title.toLowerCase())) continue;
        seen.add(title.toLowerCase());

        const r = ins.run(vendorKey, title);
        if (r.changes > 0) {
          newProducts += 1;
          const kb = await searchKnowledge(title.slice(0, 200), {
            klant: "fumero",
            limit: 2,
          });
          const hasKb = !kb.error && kb.results.length > 0;
          if (!hasKb) notInKb += 1;
        }
      }
    } catch (e) {
      errors.push(
        `${vendorKey}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  if (newProducts > 0) {
    void sendTelegramMessage(
      `🆕 ${newProducts} nieuwe producten beschikbaar (${notInKb} niet in kennisbank)`
    );
  }

  const detail = `Vendor check: ${newProducts} nieuw in snapshot, ${notInKb} mogelijk niet in KB, ${errors.length} fout(en).`;
  return {
    ok: errors.length === 0,
    detail: errors.length ? `${detail} ${errors.join("; ")}` : detail,
  };
}
