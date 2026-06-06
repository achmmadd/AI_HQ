import assert from "node:assert/strict";
import test from "node:test";
import {
  scrapePageStepLabel,
  shortScrapeUrlLabel,
} from "@/lib/fumero/fumero-live-steps";

test("shortScrapeUrlLabel: path", () => {
  assert.equal(
    shortScrapeUrlLabel("https://fumero.nl/shop/"),
    "fumero.nl/shop"
  );
});

test("scrapePageStepLabel", () => {
  assert.match(
    scrapePageStepLabel(1, 8, "https://fumero.nl/shop/"),
    /Pagina 1\/8: fumero\.nl\/shop/
  );
});
