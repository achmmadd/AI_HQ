import assert from "node:assert/strict";
import test from "node:test";
import {
  campaignPhaseLabel,
  campaignStepIndex,
} from "@/lib/photo-studio/campaign/progress-steps";

test("campaignStepIndex maps known phases", () => {
  assert.equal(campaignStepIndex("strategy"), 0);
  assert.equal(campaignStepIndex("copy"), 1);
  assert.equal(campaignStepIndex("static"), 2);
  assert.equal(campaignStepIndex("video"), 3);
  assert.equal(campaignStepIndex("zip"), 4);
  assert.equal(campaignStepIndex(null), 0);
});

test("campaignPhaseLabel returns Dutch labels", () => {
  assert.equal(campaignPhaseLabel("video"), "Media genereren");
  assert.equal(campaignPhaseLabel("unknown"), "Voorbereiden…");
});
