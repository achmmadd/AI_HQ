import assert from "node:assert/strict";
import test from "node:test";
import { generateAdStrategy } from "@/lib/photo-studio/campaign/ad-strategy";
import { generateCampaignCopy } from "@/lib/photo-studio/campaign/copy-generator";
import {
  FUMERO_PRODUCT_FIXTURES,
  brandKitRowFromFixture,
} from "@/lib/photo-studio/fixtures/fumero-products";

process.env.CAMPAIGN_TEMPLATE_ONLY = "1";

test("generateCampaignCopy produces 6 NL copy sets (2 hooks x 3 angles)", async () => {
  const kit = brandKitRowFromFixture(FUMERO_PRODUCT_FIXTURES[2]!);
  const strategy = await generateAdStrategy(kit, "verkoop", { templateOnly: true });
  const copy = await generateCampaignCopy(kit, strategy, { templateOnly: true });

  assert.equal(copy.sets.length, 6);
  for (const s of copy.sets) {
    assert.ok(s.headline.length <= 41, `Headline too long: ${s.headline}`);
    assert.ok(s.primary_text.length > 10);
    assert.ok(s.cta_primary.length > 2);
  }
  assert.equal(new Set(copy.sets.map((s) => s.angle)).size, 3);
});

test("generateCampaignCopy sets are policy-checked", async () => {
  const kit = brandKitRowFromFixture(FUMERO_PRODUCT_FIXTURES[0]!);
  const strategy = await generateAdStrategy(kit, "bereik", { templateOnly: true });
  const copy = await generateCampaignCopy(kit, strategy, { templateOnly: true });
  for (const s of copy.sets) {
    assert.equal(s.policy_pass, true);
    assert.ok(Array.isArray(s.policy_warnings));
  }
});

test("generateCampaignCopy template uses locale from brand kit", async () => {
  const kit = brandKitRowFromFixture(FUMERO_PRODUCT_FIXTURES[0]!);
  kit.locale = "de";
  const strategy = await generateAdStrategy(kit, "verkoop", { templateOnly: true });
  const copy = await generateCampaignCopy(kit, strategy, { templateOnly: true });
  assert.ok(
    copy.sets.some((s) => s.primary_text.includes("schnelle Lieferung")),
    "German delivery note expected for locale=de"
  );
});
