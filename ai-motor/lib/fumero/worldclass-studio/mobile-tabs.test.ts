import assert from "node:assert/strict";
import test from "node:test";

/** Pure logic for mobile tab panel visibility (mirrors CSS class rules). */
export function panelVisibleOnMobile(
  activeTab: "make" | "results",
  panel: "make" | "results"
): boolean {
  return activeTab === panel;
}

test("mobile tab toont alleen actief paneel", () => {
  assert.equal(panelVisibleOnMobile("make", "make"), true);
  assert.equal(panelVisibleOnMobile("make", "results"), false);
  assert.equal(panelVisibleOnMobile("results", "results"), true);
  assert.equal(panelVisibleOnMobile("results", "make"), false);
});
