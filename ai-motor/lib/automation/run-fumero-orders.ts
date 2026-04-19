import db from "@/lib/db/database";
import { sendTelegramMessage } from "@/lib/telegram";
import { withBrowser } from "@/lib/automation/playwright-browser";

function parseEurToCents(s: string | null | undefined): number {
  if (!s) return 0;
  const cleaned = s.replace(/[€\s]/g, "").trim();
  const m = cleaned.match(/(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2}|\d+\.\d{2}|\d+)/);
  if (!m) return 0;
  let num = m[1].replace(/\./g, "").replace(",", ".");
  const n = parseFloat(num);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function isOrderDateToday(dateStr: string | null | undefined, now: Date): boolean {
  if (!dateStr?.trim()) return false;
  const s = dateStr.trim();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  const iso = /(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/.exec(s);
  if (iso) {
    let yy = parseInt(iso[3], 10);
    if (yy < 100) yy += 2000;
    return (
      parseInt(iso[1], 10) === d &&
      parseInt(iso[2], 10) === m + 1 &&
      yy === y
    );
  }

  const monthsNl = [
    "januari",
    "februari",
    "maart",
    "april",
    "mei",
    "juni",
    "juli",
    "augustus",
    "september",
    "oktober",
    "november",
    "december",
  ];
  const low = s.toLowerCase();
  if (!low.includes(String(y))) return false;
  const dm = /^(\d{1,2})\s/.exec(low) || low.match(/(\d{1,2})\s+\w+/);
  const dayNum = dm ? parseInt(dm[1], 10) : NaN;
  for (let i = 0; i < 12; i++) {
    if (low.includes(monthsNl[i]!) && i === m && dayNum === d) return true;
  }
  return false;
}

function extractOrderId(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(/#?\s*(\d{3,})/);
  return m ? m[1] : null;
}

export async function runFumeroOrdersDaily(): Promise<{
  ok: boolean;
  detail: string;
}> {
  const user = process.env.FUMERO_ADMIN_USER?.trim();
  const pass = process.env.FUMERO_ADMIN_PASSWORD?.trim();
  const base =
    process.env.FUMERO_MY_ACCOUNT_URL?.trim() || "https://fumero.nl/my-account/";
  const ordersPath = process.env.FUMERO_ORDERS_PATH?.trim() || "orders";
  const ordersUrl =
    process.env.FUMERO_ORDERS_URL?.trim() ||
    new URL(ordersPath, base.endsWith("/") ? base : `${base}/`).toString();

  if (!user || !pass) {
    return {
      ok: false,
      detail:
        "Configureer FUMERO_ADMIN_USER en FUMERO_ADMIN_PASSWORD voor Playwright-login.",
    };
  }

  const rowSel =
    process.env.FUMERO_ORDERS_ROW_SEL?.trim() ||
    "table.woocommerce-orders-table tbody tr";
  const userSel =
    process.env.FUMERO_LOGIN_USER_SEL?.trim() ||
    'input[name="username"], input#username, #user_login';
  const passSel =
    process.env.FUMERO_LOGIN_PASS_SEL?.trim() ||
    'input[name="password"], input#password, #user_pass';
  const submitSel =
    process.env.FUMERO_LOGIN_SUBMIT_SEL?.trim() ||
    'button[name="login"], button[type="submit"], #customer_login input[type="submit"]';

  const now = new Date();

  try {
    const result = await withBrowser(async (context) => {
      const page = await context.newPage();
      await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60_000 });

      const hasUser = await page.locator(userSel).first().count();
      if (hasUser > 0) {
        await page.locator(userSel).first().fill(user);
        await page.locator(passSel).first().fill(pass);
        await page.locator(submitSel).first().click();
        await page.waitForLoadState("networkidle", { timeout: 60_000 }).catch(() => {});
      }

      await page.goto(ordersUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });

      const rows = await page.$$eval(
        rowSel,
        (trs, selectors) => {
          const numSel = selectors.num;
          const dateSel = selectors.date;
          const totalSel = selectors.total;
          return trs.map((tr) => {
            const num =
              tr.querySelector(numSel)?.textContent?.trim() ||
              tr.querySelector("td")?.textContent?.trim();
            const date = tr.querySelector(dateSel)?.textContent?.trim() || "";
            const total =
              tr.querySelector(totalSel)?.textContent?.trim() || "";
            return { num, date, total, rowText: tr.textContent?.slice(0, 400) || "" };
          });
        },
        {
          num:
            process.env.FUMERO_ORDER_NUMBER_SEL?.trim() ||
            ".woocommerce-orders-table__cell-order-number a, .woocommerce-orders-table__cell-order-number",
          date:
            process.env.FUMERO_ORDER_DATE_SEL?.trim() ||
            ".woocommerce-orders-table__cell-order-date time, .woocommerce-orders-table__cell-order-date",
          total:
            process.env.FUMERO_ORDER_TOTAL_SEL?.trim() ||
            ".woocommerce-orders-table__cell-order-total",
        }
      );

      const todayRows = rows.filter((r) => isOrderDateToday(r.date, now));
      const parsed = todayRows
        .map((r) => {
          const externalId = extractOrderId(r.num) || extractOrderId(r.rowText);
          if (!externalId) return null;
          return {
            externalId,
            orderDate: r.date || now.toISOString().slice(0, 10),
            totalCents: parseEurToCents(r.total),
            raw: r.rowText,
          };
        })
        .filter(Boolean) as Array<{
        externalId: string;
        orderDate: string;
        totalCents: number;
        raw: string;
      }>;

      return { parsed, rowCount: rows.length, todayCount: todayRows.length };
    });

    const ins = db.prepare(
      `INSERT OR IGNORE INTO fumero_orders (external_id, order_date, total_cents, raw_summary)
       VALUES (?,?,?,?)`
    );

    let newCount = 0;
    let totalCentsToday = 0;
    for (const o of result.parsed) {
      totalCentsToday += o.totalCents;
      const r = ins.run(o.externalId, o.orderDate, o.totalCents, o.raw);
      if (r.changes > 0) newCount += 1;
    }

    const detail = `Fumero orders: ${result.todayCount} rij(en) vandaag op pagina, ${result.parsed.length} met ordernr, ${newCount} nieuw in DB (totaal €${(totalCentsToday / 100).toFixed(2)} geschat vandaag).`;

    if (newCount > 0) {
      void sendTelegramMessage(
        `📦 ${newCount} nieuwe order(s) vandaag (€${(totalCentsToday / 100).toFixed(2)})`
      );
    }

    return { ok: true, detail };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      detail: `Fumero Playwright: ${msg}. Tip: zet FUMERO_*_SEL env vars als de site geen WooCommerce gebruikt.`,
    };
  }
}
