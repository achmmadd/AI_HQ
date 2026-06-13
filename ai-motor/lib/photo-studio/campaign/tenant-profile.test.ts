import assert from "node:assert/strict";
import test from "node:test";
import {
  detectLocaleFromUrl,
  resolveCampaignLocale,
  resolvePolicyProfile,
} from "@/lib/photo-studio/campaign/tenant-profile";
import { brandKitRowFromFixture, FUMERO_PRODUCT_FIXTURES } from "@/lib/photo-studio/fixtures/fumero-products";

test("detectLocaleFromUrl maps TLD to locale", () => {
  assert.equal(detectLocaleFromUrl("https://fumero.nl/product/x"), "nl");
  assert.equal(detectLocaleFromUrl("https://fumero.de/product/x"), "de");
  assert.equal(detectLocaleFromUrl("https://fumero.com/product/x"), "en");
  assert.equal(detectLocaleFromUrl(null), null);
});

test("resolveCampaignLocale prefers brand kit locale field", () => {
  const kit = brandKitRowFromFixture(FUMERO_PRODUCT_FIXTURES[0]!);
  kit.locale = "de";
  assert.equal(resolveCampaignLocale(kit), "de");
  delete kit.locale;
  assert.equal(resolveCampaignLocale(kit), "nl");
});

test("resolvePolicyProfile uses fumero_hhc for fumero tenant", () => {
  const kit = brandKitRowFromFixture(FUMERO_PRODUCT_FIXTURES[0]!);
  assert.equal(resolvePolicyProfile(kit), "fumero_hhc");
  kit.klant = "bokas" as typeof kit.klant;
  kit.source_url = "https://example-shop.com/product/x";
  kit.description = "Generic product";
  assert.equal(resolvePolicyProfile(kit), "default_ecom");
});

test("resolvePolicyProfile respects explicit policy_profile override", () => {
  const kit = brandKitRowFromFixture(FUMERO_PRODUCT_FIXTURES[0]!);
  kit.policy_profile = "default_ecom";
  assert.equal(resolvePolicyProfile(kit), "default_ecom");
});
