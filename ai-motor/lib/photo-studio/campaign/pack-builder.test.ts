import assert from "node:assert/strict";
import test from "node:test";
import { buildCampaignPack } from "@/lib/photo-studio/campaign/pack-builder";
import {
  FUMERO_PRODUCT_FIXTURES,
  brandKitRowFromFixture,
} from "@/lib/photo-studio/fixtures/fumero-products";

process.env.CAMPAIGN_TEMPLATE_ONLY = "1";

test("buildCampaignPack with skip_media produces ZIP for LOOM fixture", async () => {
  const fixture = FUMERO_PRODUCT_FIXTURES[1]!;
  const packId = `cp_test_${fixture.id}_${Date.now()}`;
  const pack = await buildCampaignPack(packId, {
    brandKit: brandKitRowFromFixture(fixture),
    goal: "verkoop",
    skip_media: true,
  });

  assert.equal(pack.strategy.concepts.length, 3);
  assert.equal(pack.copy.sets.length, 6);
  assert.ok(pack.zip_path);
  assert.equal(pack.status, "ready");
  assert.ok(pack.sku.includes("loom") || pack.sku.includes("strawberry"));
});

test("buildCampaignPack tolerates non-string brand kit fields from legacy JSON", async () => {
  const fixture = FUMERO_PRODUCT_FIXTURES[0]!;
  const kit = brandKitRowFromFixture(fixture);
  (kit as { product_name: unknown }).product_name = 12345;
  (kit as { name: unknown }).name = null;

  const packId = `cp_legacy_${Date.now()}`;
  const pack = await buildCampaignPack(packId, {
    brandKit: kit,
    goal: "verkoop",
    skip_media: true,
  });

  assert.equal(pack.status, "ready");
  assert.ok(pack.zip_path);
  assert.equal(pack.copy.sets.length, 6);
});

test("buildCampaignPack tolerates null product_name", async () => {
  const fixture = FUMERO_PRODUCT_FIXTURES[0]!;
  const kit = brandKitRowFromFixture(fixture);
  (kit as { product_name: unknown }).product_name = null;

  const packId = `cp_null_name_${Date.now()}`;
  const pack = await buildCampaignPack(packId, {
    brandKit: kit,
    goal: "verkoop",
    skip_media: true,
  });

  assert.equal(pack.status, "ready");
  assert.ok(pack.zip_path);
  assert.equal(pack.copy.sets.length, 6);
});
