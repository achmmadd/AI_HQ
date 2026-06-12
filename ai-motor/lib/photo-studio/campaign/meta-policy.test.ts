import assert from "node:assert/strict";
import test from "node:test";
import {
  checkMetaPolicy,
  sanitizeHeadline,
} from "@/lib/photo-studio/campaign/meta-policy";

test("checkMetaPolicy rejects health claims", () => {
  const result = checkMetaPolicy("Dit product geneest je pijn en angst.");
  assert.equal(result.pass, false);
  assert.ok(result.warnings.length > 0);
});

test("checkMetaPolicy rejects iDEAL mention", () => {
  const result = checkMetaPolicy("Betaal met iDEAL of creditcard.");
  assert.equal(result.pass, false);
});

test("checkMetaPolicy passes clean Fumero copy", () => {
  const result = checkMetaPolicy(
    "Premium HHC vape bij Fumero. Discreet verpakt, snelle levering. 18+."
  );
  assert.equal(result.pass, true);
});

test("sanitizeHeadline enforces 40 char limit", () => {
  const long = "Dit is een veel te lange headline die niet past in Meta ads";
  const out = sanitizeHeadline(long, 40);
  assert.ok(out.length <= 40);
});
