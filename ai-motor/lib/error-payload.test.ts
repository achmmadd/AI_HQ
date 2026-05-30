import assert from "node:assert/strict";
import test from "node:test";
import { buildErrorPayload } from "./error-payload";

test("buildErrorPayload zonder detail", () => {
  assert.deepEqual(buildErrorPayload("oops"), { error: "oops" });
});

test("buildErrorPayload met detail", () => {
  assert.deepEqual(buildErrorPayload("oops", "meer"), {
    error: "oops",
    detail: "meer",
  });
});
