#!/usr/bin/env node
/** Quick verify: Kings HHC live price must parse as 24.95 */
import {
  parseProductPageHtml,
  extractProductSectionHtml,
} from "../lib/photo-studio/brand-kit/parse-product-page.ts";

const url =
  "https://fumero.nl/product/kings-hhc-disposable-vape-super-lemon-haze-500mg/";
const res = await fetch(url, {
  headers: { "User-Agent": "MotorsAI-Verify/1.0" },
});
const html = await res.text();
const scoped = extractProductSectionHtml(html);
const parsed = parseProductPageHtml(html, url);

console.log("HTTP", res.status);
console.log("scoped_len", scoped.length, "has_entry_summary", /entry-summary/i.test(html));
console.log("has_json_ld_product", /"@type"\s*:\s*"Product"/i.test(html));
console.log("price:", parsed.price, "(expected 24.95)");
console.log("product:", parsed.product_name?.slice(0, 60));
console.log("images:", parsed.images.length);
console.log("warnings:", parsed.warnings);

if (parsed.price !== "24.95") {
  const snippet = scoped.match(/woocommerce-Price-amount[\s\S]{0,120}/i)?.[0];
  if (snippet) console.log("scoped_price_snippet:", snippet.replace(/\s+/g, " ").slice(0, 120));
  console.error("FAIL: wrong price");
  process.exit(1);
}
console.log("OK");
