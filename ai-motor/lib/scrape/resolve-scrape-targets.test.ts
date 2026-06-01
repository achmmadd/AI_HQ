import assert from "node:assert/strict";
import test from "node:test";
import {
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
