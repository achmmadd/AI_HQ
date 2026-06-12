import assert from "node:assert/strict";
import { access } from "fs/promises";
import test from "node:test";
import {
  FUMERO_PRODUCT_FIXTURES,
  brandKitFromFixture,
} from "@/lib/photo-studio/fixtures/fumero-products";
import { validateBrandKitData } from "@/lib/photo-studio/brand-kit/types";
import {
  checkFileFormat,
  checkResolution,
  runQualityChecks,
} from "@/lib/photo-studio/quality";

test("FUMERO_PRODUCT_FIXTURES: all 3 baseline PNGs exist on disk", async () => {
  assert.equal(FUMERO_PRODUCT_FIXTURES.length, 3);
  for (const fixture of FUMERO_PRODUCT_FIXTURES) {
    await access(fixture.imagePath);
    assert.ok(fixture.product_name.length > 3);
    assert.ok(fixture.variant.length > 3);
  }
});

test("brandKitFromFixture validates for each baseline product", () => {
  for (const fixture of FUMERO_PRODUCT_FIXTURES) {
    const kit = brandKitFromFixture(fixture);
    assert.equal(validateBrandKitData(kit), null);
    assert.equal(kit.images[0]?.role, "product");
    assert.ok(kit.images[0]?.url.includes(fixture.filename));
  }
});

test("baseline fixtures: file format check passes (PNG/JPEG)", async () => {
  for (const fixture of FUMERO_PRODUCT_FIXTURES) {
    const result = await checkFileFormat(fixture.imagePath);
    assert.notEqual(result.status, "fail", `${fixture.id}: ${result.message}`);
  }
});

test("baseline fixtures: resolution baseline at 1024px (warn, not pass)", async () => {
  for (const fixture of FUMERO_PRODUCT_FIXTURES) {
    const result = await checkResolution(fixture.imagePath, "1:1");
    assert.ok(result.score !== undefined && result.score! < 2048);
    assert.notEqual(result.status, "pass", `${fixture.id} should not pass 2048px gate`);
    assert.ok(
      result.status === "warn" || result.status === "fail",
      `${fixture.id}: expected warn/fail, got ${result.status}`
    );
  }
});

test("baseline fixtures: runQualityChecks on strawberry dream 1:1", async () => {
  const fixture = FUMERO_PRODUCT_FIXTURES[0]!;
  const checks = await runQualityChecks({
    outputPath: fixture.imagePath,
    format: "1:1",
  });
  assert.ok(checks.length >= 3);
  const resolution = checks.find((c) => c.id === "S3");
  assert.ok(resolution);
});
