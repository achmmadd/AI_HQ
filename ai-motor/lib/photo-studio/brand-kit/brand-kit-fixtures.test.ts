import assert from "node:assert/strict";
import test from "node:test";
import {
  FUMERO_PRODUCT_FIXTURES,
  brandKitFromFixture,
} from "@/lib/photo-studio/fixtures/fumero-products";
import { validateBrandKitData } from "@/lib/photo-studio/brand-kit/types";

test("brandKitFromFixture: Delta Munchies Strawberry Dream", () => {
  const fixture = FUMERO_PRODUCT_FIXTURES[0]!;
  const kit = brandKitFromFixture(fixture);
  assert.equal(validateBrandKitData(kit), null);
  assert.match(kit.product_name, /Strawberry Dream/i);
  assert.equal(kit.price, "29.95");
  assert.equal(kit.images[0]?.role, "product");
});

test("brandKitFromFixture: LOOM Strawberry Ice", () => {
  const fixture = FUMERO_PRODUCT_FIXTURES[1]!;
  const kit = brandKitFromFixture(fixture);
  assert.match(kit.product_name, /LOOM/i);
  assert.match(kit.product_name, /Strawberry Ice/i);
});

test("brandKitFromFixture: Delta Munchies OG Kush Indica", () => {
  const fixture = FUMERO_PRODUCT_FIXTURES[2]!;
  const kit = brandKitFromFixture(fixture);
  assert.match(kit.product_name, /OG Kush/i);
  assert.match(kit.description, /Indica/i);
});
