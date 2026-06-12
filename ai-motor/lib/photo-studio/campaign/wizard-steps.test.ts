import assert from "node:assert/strict";
import test from "node:test";
import {
  canAdvanceWizardStep,
  sanitizeWizardStepAfterRefresh,
  wizardNextStep,
  wizardPrevStep,
  wizardStepIndex,
} from "./wizard-steps";

test("wizardStepIndex en navigatie", () => {
  assert.equal(wizardStepIndex("brand"), 0);
  assert.equal(wizardStepIndex("preview"), 4);
  assert.equal(wizardPrevStep("brand"), null);
  assert.equal(wizardPrevStep("goal"), "brand");
  assert.equal(wizardNextStep("brand"), "goal");
  assert.equal(wizardNextStep("preview"), null);
});

test("sanitizeWizardStepAfterRefresh reset generate naar concepts", () => {
  assert.equal(sanitizeWizardStepAfterRefresh("generate"), "concepts");
  assert.equal(sanitizeWizardStepAfterRefresh("goal"), "goal");
});

test("canAdvanceWizardStep vereist brand kit op stap 1", () => {
  assert.equal(
    canAdvanceWizardStep("brand", { selectedKitId: null, hasStrategy: false }),
    false
  );
  assert.equal(
    canAdvanceWizardStep("brand", { selectedKitId: "bk_1", hasStrategy: false }),
    true
  );
  assert.equal(
    canAdvanceWizardStep("concepts", { selectedKitId: "bk_1", hasStrategy: false }),
    false
  );
  assert.equal(
    canAdvanceWizardStep("concepts", { selectedKitId: "bk_1", hasStrategy: true }),
    true
  );
});
