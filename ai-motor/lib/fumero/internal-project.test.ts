import test from "node:test";
import assert from "node:assert/strict";
import { isInternalCodeProject } from "@/lib/fumero/internal-project";

test("isInternalCodeProject hides phase tests and imports", () => {
  assert.equal(isInternalCodeProject("_phase-test-abc"), true);
  assert.equal(isInternalCodeProject("_import-xyz"), true);
  assert.equal(isInternalCodeProject("my-shop"), false);
});
