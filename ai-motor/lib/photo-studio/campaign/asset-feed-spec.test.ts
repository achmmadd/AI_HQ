import assert from "node:assert/strict";
import test from "node:test";
import { buildAssetFeedSpec } from "@/lib/photo-studio/campaign/asset-feed-spec";
import type { CampaignPackData } from "@/lib/photo-studio/campaign/types";

function minimalPack(): CampaignPackData {
  return {
    brand_kit_id: "bk_test",
    brand_name: "Fumero",
    product_name: "Strawberry Dream",
    sku: "strawberry-dream",
    goal: "verkoop",
    strategy: {
      goal: "verkoop",
      goal_label: "Verkoop",
      brand_kit_id: "bk_test",
      product_name: "Strawberry Dream",
      concepts: [
        {
          angle: "prijs",
          angle_label: "Prijs",
          hook: "Premium HHC vanaf €24,95",
          visual_direction: "product hero",
          rationale: "value",
        },
      ],
      generated_at: "2026-06-13T12:00:00.000Z",
      source: "template",
    },
    copy: {
      goal: "verkoop",
      brand_kit_id: "bk_test",
      sets: [
        {
          angle: "prijs",
          hook_variant: 1,
          headline: "Premium HHC",
          primary_text: "Ontdek Strawberry Dream.",
          description: "Snel geleverd in NL.",
          cta_primary: "Bestel nu",
          cta_secondary: "Naar de shop",
          policy_warnings: [],
          policy_pass: true,
        },
      ],
      generated_at: "2026-06-13T12:00:00.000Z",
      source: "template",
    },
    static_assets: [
      {
        concept_angle: "prijs",
        hook: "Premium HHC vanaf €24,95",
        format: "1:1",
        filename: "fumero_strawberry-dream_prijs_1x1_v1.jpg",
        file_path: "/tmp/static.jpg",
        public_url: "",
        width: 1080,
        height: 1080,
        generation_id: 1,
        quality_checks: [],
        quality_pass: true,
      },
      {
        concept_angle: "prijs",
        hook: "Premium HHC vanaf €24,95",
        format: "4:5",
        filename: "fumero_strawberry-dream_prijs_4x5_v1.jpg",
        file_path: "/tmp/static45.jpg",
        public_url: "",
        width: 1080,
        height: 1350,
        generation_id: 2,
        quality_checks: [],
        quality_pass: true,
      },
    ],
    video_assets: [
      {
        concept_angle: "prijs",
        hook: "Premium HHC vanaf €24,95",
        format: "9:16",
        filename: "fumero_strawberry-dream_prijs_9x16_v1.mp4",
        file_path: "/tmp/video.mp4",
        public_url: "",
        generation_id: 3,
        quality_checks: [],
        quality_pass: true,
      },
    ],
    errors: [],
  };
}

test("buildAssetFeedSpec matches Meta skeleton shape", () => {
  const spec = buildAssetFeedSpec(minimalPack());

  assert.equal(spec.optimization_type, "REGULAR");
  assert.ok(spec.titles.length >= 1);
  assert.ok(spec.bodies.length >= 1);
  assert.ok(spec.descriptions.length >= 1);
  assert.deepEqual(spec.call_to_action_types, ["SHOP_NOW", "ORDER_NOW"]);
  assert.equal(spec.images.length, 2);
  assert.equal(spec.images[0]?.zip_path, "static/fumero_strawberry-dream_prijs_1x1_v1.jpg");
  assert.equal(spec.videos[0]?.zip_path, "video/fumero_strawberry-dream_prijs_9x16_v1.mp4");
  assert.ok(spec.ad_formats.includes("SINGLE_IMAGE"));
  assert.ok(spec.ad_formats.includes("SINGLE_VIDEO"));
});
