import assert from "node:assert/strict";
import test from "node:test";
import {
  assertScrapeUrlAllowed,
  scrapeUrlHostnameAllowedForTenant,
  scrapeUrlDocumentId,
} from "@/lib/scrape/scrape-url";
import { getScrapeProviderMode } from "@/lib/scrape/providers/resolve";
import { getScrapeTenantConfig } from "@/lib/scrape/tenants";

test("fumero tenant whitelist", () => {
  const t = getScrapeTenantConfig("fumero");
  assert.ok(t);
  assert.equal(scrapeUrlHostnameAllowedForTenant("fumero.nl", "fumero"), true);
  assert.equal(scrapeUrlHostnameAllowedForTenant("evil.com", "fumero"), false);
});

test("bokas tenant: lege whitelist tot configuratie", () => {
  assert.equal(scrapeUrlHostnameAllowedForTenant("fumero.nl", "bokas"), false);
});

test("assertScrapeUrlAllowed fumero", () => {
  assert.equal(assertScrapeUrlAllowed("https://fumero.nl/shop/", "fumero"), null);
});

test("scrapeUrlDocumentId stabiel", () => {
  const a = scrapeUrlDocumentId("https://fumero.nl/shop/");
  const b = scrapeUrlDocumentId("https://fumero.nl/shop/");
  assert.equal(a, b);
});

test("SCRAPE_PROVIDER default auto", () => {
  const prev = process.env.SCRAPE_PROVIDER;
  delete process.env.SCRAPE_PROVIDER;
  assert.equal(getScrapeProviderMode(), "auto");
  if (prev !== undefined) process.env.SCRAPE_PROVIDER = prev;
});
