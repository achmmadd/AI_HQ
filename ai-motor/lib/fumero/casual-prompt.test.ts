import assert from "node:assert/strict";
import test from "node:test";
import {
  looksLikeBroadSiteCheckRequest,
  looksLikeCasualBuildRequest,
  looksLikeCasualScrapeRequest,
  looksLikeCasualSiteCheckFfRequest,
} from "@/lib/fumero/casual-prompt";
import { shouldScrapeFromPrompt } from "@/lib/scrape/resolve-scrape-targets";

test("casual build: klantvragen op site", () => {
  assert.equal(
    looksLikeCasualBuildRequest(
      "iets op de site zodat klanten vragen kunnen stellen"
    ),
    true
  );
});

test("casual build: landingspagina voor zaak", () => {
  assert.equal(
    looksLikeCasualBuildRequest("maak een landingspagina voor mijn kapsalon"),
    true
  );
});

test("casual build: bestelformulier", () => {
  assert.equal(
    looksLikeCasualBuildRequest("bouw een bestelformulier voor mijn shop"),
    true
  );
});

test("broad site check: check hele site", () => {
  assert.equal(looksLikeBroadSiteCheckRequest("check hele site"), true);
  assert.equal(
    looksLikeCasualScrapeRequest("check hele site van fumero"),
    true
  );
});

test("casual site check: check ff", () => {
  assert.equal(looksLikeCasualSiteCheckFfRequest("check ff"), true);
  assert.equal(shouldScrapeFromPrompt("check ff", "fumero"), true);
});

test("casual scrape: fumero info voor bot", () => {
  assert.equal(
    looksLikeCasualScrapeRequest(
      "pak de info van fumero voor een bot op de website"
    ),
    true
  );
});
