import db from "@/lib/db/database";
import { sendTelegramMessage } from "@/lib/telegram";
import { withBrowser } from "@/lib/automation/playwright-browser";

function slugKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function parseQty(s: string | null | undefined): number {
  if (!s) return 0;
  const m = s.match(/-?\d+/);
  return m ? parseInt(m[0], 10) : 0;
}

export async function runInventoryUpdate(): Promise<{
  ok: boolean;
  detail: string;
}> {
  const url = process.env.SUPPLIER_INVENTORY_URL?.trim();
  if (!url) {
    return {
      ok: false,
      detail:
        "SUPPLIER_INVENTORY_URL ontbreekt (leverancierspagina met voorraad).",
    };
  }

  const rowSel =
    process.env.INVENTORY_ROW_SEL?.trim() ||
    "table tbody tr, .product-row, li.product";
  const nameSel =
    process.env.INVENTORY_NAME_SEL?.trim() ||
    "td:nth-child(1), .product-name, h2.woocommerce-loop-product__title, .name";
  const qtySel =
    process.env.INVENTORY_QTY_SEL?.trim() ||
    "td:nth-child(2), .stock, .qty, [data-stock]";

  try {
    const items = await withBrowser(async (context) => {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
      return page.$$eval(
        rowSel,
        (nodes, sel) => {
          const { name: ns, qty: qs } = sel;
          return nodes.map((el) => {
            const name =
              el.querySelector(ns)?.textContent?.trim().replace(/\s+/g, " ") ||
              "";
            const qtyRaw =
              el.querySelector(qs)?.textContent?.trim() ||
              el.getAttribute("data-stock") ||
              "";
            return { name, qtyRaw };
          });
        },
        { name: nameSel, qty: qtySel }
      );
    });

    const upsert = db.prepare(
      `INSERT INTO inventory (product_key, name, qty, supplier_url, updated_at)
       VALUES (@product_key, @name, @qty, @supplier_url, datetime('now'))
       ON CONFLICT(product_key) DO UPDATE SET
         name = excluded.name,
         qty = excluded.qty,
         supplier_url = excluded.supplier_url,
         updated_at = excluded.updated_at`
    );

    let updated = 0;
    const lowStock: { name: string; qty: number; th: number }[] = [];

    for (const row of items) {
      if (!row.name || row.name.length < 2) continue;
      const qty = parseQty(row.qtyRaw);
      const product_key = slugKey(row.name);
      if (!product_key) continue;

      const existing = db
        .prepare(
          `SELECT low_stock_threshold FROM inventory WHERE product_key = ?`
        )
        .get(product_key) as { low_stock_threshold: number } | undefined;
      const th = existing?.low_stock_threshold ?? 10;

      upsert.run({
        product_key,
        name: row.name,
        qty,
        supplier_url: url,
      });
      updated += 1;
      if (qty < th) {
        lowStock.push({ name: row.name, qty, th });
      }
    }

    if (lowStock.length > 0) {
      const lines = lowStock
        .slice(0, 15)
        .map((x) => `• ${x.name}: ${x.qty} (< ${x.th})`)
        .join("\n");
      void sendTelegramMessage(
        `⚠️ Lage voorraad (${lowStock.length}):\n${lines}`
      );
    }

    return {
      ok: true,
      detail: `Voorraad: ${updated} regels bijgewerkt van ${items.length} gescrapete rijen.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      detail: `Inventory Playwright: ${msg}. Pas INVENTORY_*_SEL selectors aan.`,
    };
  }
}
