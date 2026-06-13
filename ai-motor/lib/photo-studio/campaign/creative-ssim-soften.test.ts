import assert from "node:assert/strict";
import test from "node:test";
import { softenPortraitSsimAgainstSquare } from "@/lib/photo-studio/campaign/creative";
import type { CampaignCreativeAsset } from "@/lib/photo-studio/campaign/types";
import type { QualityCheckResult } from "@/lib/photo-studio/quality/types";

function asset(
  format: "1:1" | "4:5",
  ssimStatus: QualityCheckResult["status"],
  qualityPass: boolean
): CampaignCreativeAsset {
  return {
    concept_angle: "prijs",
    hook: "test",
    format,
    filename: `test_${format.replace(":", "x")}.jpg`,
    file_path: `/tmp/test_${format}.jpg`,
    public_url: "",
    width: 1080,
    height: format === "1:1" ? 1080 : 1350,
    generation_id: 1,
    quality_checks: [
      {
        id: "T3",
        criterion: "SSIM fidelity",
        status: ssimStatus,
        score: ssimStatus === "pass" ? 0.9 : 0.7,
        message: "SSIM test",
      },
    ],
    quality_pass: qualityPass,
  };
}

test("softenPortraitSsimAgainstSquare downgrades 4:5 SSIM fail when 1:1 passes", () => {
  const result = softenPortraitSsimAgainstSquare([
    asset("1:1", "pass", true),
    asset("4:5", "fail", false),
  ]);

  const portrait = result.find((a) => a.format === "4:5");
  assert.ok(portrait);
  const ssim = portrait.quality_checks.find((c) => c.id === "T3");
  assert.equal(ssim?.status, "warn");
  assert.equal(portrait.quality_pass, true);
});

test("softenPortraitSsimAgainstSquare leaves 4:5 fail when 1:1 also fails", () => {
  const result = softenPortraitSsimAgainstSquare([
    asset("1:1", "fail", false),
    asset("4:5", "fail", false),
  ]);

  const portrait = result.find((a) => a.format === "4:5");
  assert.equal(portrait?.quality_checks.find((c) => c.id === "T3")?.status, "fail");
  assert.equal(portrait?.quality_pass, false);
});
