import assert from "node:assert/strict";
import test from "node:test";
import { generateAdStrategy } from "@/lib/photo-studio/campaign/ad-strategy";
import { generateCampaignCopy } from "@/lib/photo-studio/campaign/copy-generator";
import { buildCampaignPack } from "@/lib/photo-studio/campaign/pack-builder";
import { pickScenePreset } from "@/lib/photo-studio/campaign/scene-presets";
import {
  FUMERO_PRODUCT_FIXTURES,
  brandKitRowFromFixture,
} from "@/lib/photo-studio/fixtures/fumero-products";

process.env.CAMPAIGN_TEMPLATE_ONLY = "1";

for (const fixture of FUMERO_PRODUCT_FIXTURES) {
  test(`baseline campaign: ${fixture.variant} — 3 concepts from BrandKit`, async () => {
    const kit = brandKitRowFromFixture(fixture);
    const strategy = await generateAdStrategy(kit, "verkoop", { templateOnly: true });

    assert.equal(strategy.concepts.length, 3);
    assert.equal(strategy.product_name, kit.product_name);
    const angles = new Set(strategy.concepts.map((c) => c.angle));
    assert.equal(angles.size, 3);
  });

  test(`baseline campaign: ${fixture.variant} — 6 NL copy sets, policy-safe`, async () => {
    const kit = brandKitRowFromFixture(fixture);
    const strategy = await generateAdStrategy(kit, "bereik", { templateOnly: true });
    const copy = await generateCampaignCopy(kit, strategy, { templateOnly: true });

    assert.equal(copy.sets.length, 6);
    for (const s of copy.sets) {
      assert.ok(s.headline.length <= 41);
      assert.ok(s.primary_text.length > 10);
      assert.equal(s.policy_pass, true, `Policy fail: ${s.policy_warnings.join(", ")}`);
    }
  });

  test(`baseline campaign: ${fixture.variant} — scene preset per angle`, async () => {
    const kit = brandKitRowFromFixture(fixture);
    const strategy = await generateAdStrategy(kit, "verkoop", { templateOnly: true });
    for (const concept of strategy.concepts) {
      const preset = pickScenePreset(concept, "verkoop", kit.product_name);
      assert.ok(preset.blocks.subject.length > 5);
    }
  });
}

test("baseline pack: strawberry dream ZIP export (skip media)", async () => {
  const fixture = FUMERO_PRODUCT_FIXTURES[0]!;
  const kit = brandKitRowFromFixture(fixture);
  const packId = `cp_baseline_${fixture.id}_${Date.now()}`;
  const pack = await buildCampaignPack(packId, {
    brandKit: kit,
    goal: "verkoop",
    skip_media: true,
  });

  assert.equal(pack.status, "ready");
  assert.ok(pack.zip_path);
  assert.equal(pack.copy.sets.length, 6);
  assert.equal(pack.strategy.concepts.length, 3);
});
