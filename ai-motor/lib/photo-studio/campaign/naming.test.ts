import assert from "node:assert/strict";
import test from "node:test";
import { campaignAssetFilename, deriveSku } from "@/lib/photo-studio/campaign/naming";

test("campaignAssetFilename follows {brand}_{sku}_{hook}_{format}_{v01}", () => {
  const name = campaignAssetFilename({
    brand: "Fumero Premium",
    sku: "hhc_vape",
    hook: "Premium kwaliteit",
    format: "1:1",
    version: 1,
  });
  assert.match(name, /^fumero_[a-z0-9_]+_premium_kwaliteit_1x1_v01\.jpg$/);
});

test("deriveSku uses product name slug", () => {
  assert.equal(deriveSku("HHC Vape Pen", "bk_123"), "hhc_vape_pen");
});

test("deriveSku coerces non-string product_name from legacy brand kits", () => {
  assert.equal(deriveSku(12345 as unknown as string, "bk_123"), "12345");
});

test("campaignAssetFilename coerces null brand and hook", () => {
  const name = campaignAssetFilename({
    brand: null as unknown as string,
    sku: "test",
    hook: undefined as unknown as string,
    format: "1:1",
    version: 1,
  });
  assert.match(name, /^asset_test_asset_1x1_v01\.jpg$/);
});
