import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import test from "node:test";
import sharp from "sharp";
import { runQualityChecks } from "@/lib/photo-studio/quality";
import {
  DEFAULT_PRODUCT_BBOX,
  prepareProductReferencePath,
} from "@/lib/photo-studio/campaign/creative";
import { FUMERO_PRODUCT_FIXTURES } from "@/lib/photo-studio/fixtures/fumero-products";

test("prepareProductReferencePath writes product ref from file:// fixture", async () => {
  const fixture = FUMERO_PRODUCT_FIXTURES[0]!;
  const packId = `cp_ssim_test_${Date.now()}`;
  const refPath = await prepareProductReferencePath(packId, `file://${fixture.imagePath}`);
  assert.ok(refPath.includes("refs/product-ref.jpg"));
});

test("runQualityChecks with product ref and bbox includes SSIM", async () => {
  const fixture = FUMERO_PRODUCT_FIXTURES[0]!;
  const dir = await mkdtemp(path.join(os.tmpdir(), "campaign-ssim-"));
  const input = path.join(dir, "input.jpg");
  const output = path.join(dir, "output.jpg");
  await sharp(fixture.imagePath).jpeg().toFile(input);
  await sharp(fixture.imagePath).jpeg().toFile(output);

  const checks = await runQualityChecks({
    inputPath: input,
    outputPath: output,
    format: "1:1",
    productBbox: DEFAULT_PRODUCT_BBOX,
  });

  const ssim = checks.find((c) => c.id === "T3");
  assert.ok(ssim, "SSIM check should run when inputPath is set");
  assert.equal(ssim.status, "pass");
});
