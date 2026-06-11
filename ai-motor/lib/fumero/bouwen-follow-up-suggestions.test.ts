import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveBouwenFollowUpSuggestions } from "@/lib/fumero/bouwen-follow-up-suggestions";

describe("deriveBouwenFollowUpSuggestions", () => {
  it("returns at most two suggestions after build", () => {
    const items = deriveBouwenFollowUpSuggestions({
      kind: "build",
      deployType: "widget",
    });
    assert.equal(items.length, 2);
    assert.ok(items[0]?.label);
    assert.ok(items[0]?.prompt);
  });

  it("returns iterate-specific suggestions", () => {
    const items = deriveBouwenFollowUpSuggestions({ kind: "iterate" });
    assert.equal(items.length, 2);
    assert.match(items[0]!.label, /tweak|tweaken/i);
  });
});
