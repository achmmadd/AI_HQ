/**
 * One pinned P0 reference — not a source registry.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import {
  P2_PINNED_P0_REFERENCE,
  P2_P0_TITLE_MAX,
  isBoundedP0Title,
  resolvePinnedP0Reference,
} from "./p2-p0-reference.ts";

test("resolver knows exactly one pin and rejects every other id", () => {
  assert.equal(resolvePinnedP0Reference(P2_PINNED_P0_REFERENCE.source_id), P2_PINNED_P0_REFERENCE);
  assert.equal(resolvePinnedP0Reference("p0-unknown"), null);
  assert.equal(resolvePinnedP0Reference(""), null);
  assert.equal(resolvePinnedP0Reference(undefined), null);

  const src = readFileSync(join(import.meta.dirname, "p2-p0-reference.ts"), "utf8");
  assert.doesNotMatch(src, /P2_PINNED_P0_REFERENCES|sourceRegistry|SOURCE_KINDS/);
  assert.equal(src.includes("source_kind: \"qdrant\""), false);
  assert.doesNotMatch(src, /MODEL_PORT_URL|QDRANT_|CONTEXT_FILE|fetch\(/);
});

test("pinned title stays inside the display bound", () => {
  assert.equal(isBoundedP0Title(P2_PINNED_P0_REFERENCE.title), true);
  assert.ok(P2_PINNED_P0_REFERENCE.title.length <= P2_P0_TITLE_MAX);
  assert.equal(isBoundedP0Title(""), false);
  assert.equal(isBoundedP0Title(`${"x".repeat(P2_P0_TITLE_MAX + 1)}`), false);
  assert.equal(isBoundedP0Title("line\nbreak"), false);
  assert.equal(isBoundedP0Title(P2_PINNED_P0_REFERENCE.digest), false);
});
