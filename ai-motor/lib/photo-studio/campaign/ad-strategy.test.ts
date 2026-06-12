import assert from "node:assert/strict";
import test from "node:test";
import {
  AD_ANGLE_TEMPLATES,
  generateAdStrategy,
} from "@/lib/photo-studio/campaign/ad-strategy";
import {
  FUMERO_PRODUCT_FIXTURES,
  brandKitRowFromFixture,
} from "@/lib/photo-studio/fixtures/fumero-products";

process.env.CAMPAIGN_TEMPLATE_ONLY = "1";

test("AD_ANGLE_TEMPLATES has 3 distinct angles", () => {
  const ids = Object.keys(AD_ANGLE_TEMPLATES);
  assert.equal(ids.length, 3);
  assert.deepEqual(ids.sort(), ["prijs", "probleem_oplossing", "vertrouwen"].sort());
});

test("generateAdStrategy returns 3 concepts from BrandKit (template)", async () => {
  const fixture = FUMERO_PRODUCT_FIXTURES[0]!;
  const strategy = await generateAdStrategy(
    brandKitRowFromFixture(fixture),
    "verkoop",
    { templateOnly: true }
  );
  assert.equal(strategy.concepts.length, 3);
  const angles = strategy.concepts.map((c) => c.angle);
  assert.equal(new Set(angles).size, 3);
  for (const c of strategy.concepts) {
    assert.ok(c.hook.length > 5);
    assert.ok(c.visual_direction.length > 10);
  }
});

test("generateAdStrategy adapts per goal label", async () => {
  const kit = brandKitRowFromFixture(FUMERO_PRODUCT_FIXTURES[1]!);
  const bereik = await generateAdStrategy(kit, "bereik", { templateOnly: true });
  const retarget = await generateAdStrategy(kit, "retargeting", { templateOnly: true });
  assert.equal(bereik.goal_label, "Bereik");
  assert.equal(retarget.goal_label, "Retargeting");
});
