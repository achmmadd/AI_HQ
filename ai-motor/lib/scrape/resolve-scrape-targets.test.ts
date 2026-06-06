import assert from "node:assert/strict";
import test from "node:test";
import {
  isBroadSiteScrapeIntent,
  resolveScrapePageLimit,
  resolveScrapeTargets,
  shouldScrapeFromPrompt,
} from "@/lib/scrape/resolve-scrape-targets";

test("scrape intent met fumero.nl zonder https", () => {
  const p =
    "scrape de info van fumero.nl voor alle benodigde info om de chatbot te bouwen";
  assert.equal(shouldScrapeFromPrompt(p, "fumero"), true);
  const urls = resolveScrapeTargets(p, "fumero", { maxPages: 5 });
  assert.ok(urls.length >= 2);
  assert.ok(urls.every((u) => u.includes("fumero.nl")));
});

test("alleen URL zonder scrape-intent: geen scrape", () => {
  assert.equal(
    shouldScrapeFromPrompt("Zie https://fumero.nl/shop/ voor info", "fumero"),
    false
  );
});

test("informele scrape: haal info van fumero voor chatbot", () => {
  const p = "haal even de info van fumero voor een chatbot op de site";
  assert.equal(shouldScrapeFromPrompt(p, "fumero"), true);
});

test("check ff: fumero breed scrape", () => {
  const p = "check ff";
  assert.equal(shouldScrapeFromPrompt(p, "fumero"), true);
  const urls = resolveScrapeTargets(p, "fumero");
  assert.ok(urls.length >= 2);
});

test("check hele site: breed scrape zonder URL", () => {
  const p = "check hele site voor de chatbot";
  assert.equal(shouldScrapeFromPrompt(p, "fumero"), true);
  assert.equal(isBroadSiteScrapeIntent(p), true);
  assert.equal(resolveScrapePageLimit(p), 8);
  const urls = resolveScrapeTargets(p, "fumero");
  assert.ok(urls.length >= 4);
  assert.ok(urls.some((u) => u.includes("veel-gestelde-vragen")));
});

test("pad zonder https: veel-gestelde-vragen", () => {
  const p =
    "scrape de info van fumero.nl/veel-gestelde-vragen/ voor de chatbot kennisbank";
  assert.equal(shouldScrapeFromPrompt(p, "fumero"), true);
  const urls = resolveScrapeTargets(p, "fumero", { maxPages: 5 });
  assert.ok(
    urls.some((u) => u.includes("veel-gestelde-vragen")),
    `verwacht FAQ-URL, kreeg: ${urls.join(", ")}`
  );
});
