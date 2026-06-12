import assert from "node:assert/strict";
import test from "node:test";
import { friendlyFalError } from "@/lib/photo-studio/fal";

test("friendlyFalError coerces non-string fal detail (array/object)", () => {
  const msg = friendlyFalError(
    [{ loc: ["body", "image_urls"], msg: "field required", type: "value_error" }],
    true
  );
  assert.ok(typeof msg === "string" && msg.length > 0);
  assert.match(msg, /Referentiebeeld|image/i);
});

test("friendlyFalError handles null detail", () => {
  assert.equal(
    friendlyFalError(null),
    "fal.ai aanroep mislukt"
  );
});
