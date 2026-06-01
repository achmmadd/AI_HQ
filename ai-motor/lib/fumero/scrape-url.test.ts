import assert from "node:assert/strict";
import test from "node:test";
import {
  assertScrapeUrlAllowed,
  scrapeUrlHostnameAllowed,
  scrapeUrlDocumentId,
} from "@/lib/fumero/scrape-url";
import {
  shouldScrapeUrlsForMaxChat,
} from "@/lib/fumero/scrape-url-chat";

test("scrapeUrlHostnameAllowed: fumero en subdomein", () => {
  assert.equal(scrapeUrlHostnameAllowed("fumero.nl"), true);
  assert.equal(scrapeUrlHostnameAllowed("www.fumero.nl"), true);
  assert.equal(scrapeUrlHostnameAllowed("evil.com"), false);
  assert.equal(scrapeUrlHostnameAllowed("notfumero.nl"), false);
});

test("assertScrapeUrlAllowed: whitelist", () => {
  assert.equal(assertScrapeUrlAllowed("https://fumero.nl/shop/"), null);
  assert.match(
    assertScrapeUrlAllowed("https://example.com/x") ?? "",
    /niet toegestaan/i
  );
});

test("scrapeUrlDocumentId: stabiel per URL", () => {
  const a = scrapeUrlDocumentId("https://fumero.nl/shop/");
  const b = scrapeUrlDocumentId("https://fumero.nl/shop/");
  const c = scrapeUrlDocumentId("https://fumero.nl/contact/");
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("shouldScrapeUrlsForMaxChat: live intent + fumero URL", () => {
  assert.equal(
    shouldScrapeUrlsForMaxChat(
      "Check de actuele prijzen op https://fumero.nl/shop/"
    ),
    true
  );
});

test("shouldScrapeUrlsForMaxChat: alleen URL zonder intent", () => {
  assert.equal(
    shouldScrapeUrlsForMaxChat("Zie https://fumero.nl/shop/ voor info"),
    false
  );
});

test("shouldScrapeUrlsForMaxChat: explicit scrape_url", () => {
  assert.equal(
    shouldScrapeUrlsForMaxChat("scrape_url: https://fumero.nl/shop/"),
    true
  );
});

test("shouldScrapeUrlsForMaxChat: jina(url) alias", () => {
  assert.equal(
    shouldScrapeUrlsForMaxChat("jina(https://fumero.nl/shop/)"),
    true
  );
});
