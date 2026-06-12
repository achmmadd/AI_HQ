import assert from "node:assert/strict";
import test from "node:test";
import {
  CAMPAIGN_WIZARD_DEFAULT,
  CAMPAIGN_WIZARD_STORAGE_KEY,
  buildCampaignWizardSearchParams,
  readCampaignWizardFromSearchParams,
  readCampaignWizardState,
  writeCampaignWizardState,
} from "./wizard-storage";

test("readCampaignWizardState valt terug op default", () => {
  assert.deepEqual(readCampaignWizardState(null), CAMPAIGN_WIZARD_DEFAULT);
  assert.deepEqual(readCampaignWizardState({ getItem: () => null, setItem: () => {}, removeItem: () => {} }), CAMPAIGN_WIZARD_DEFAULT);
});

test("write en read campaign wizard state", () => {
  let saved = "";
  const storage = {
    getItem: () => saved,
    setItem: (_k: string, v: string) => {
      saved = v;
    },
    removeItem: () => {
      saved = "";
    },
  };
  writeCampaignWizardState(
    { step: "goal", selectedKitId: "bk_1", goal: "bereik" },
    storage
  );
  assert.equal(saved.includes(CAMPAIGN_WIZARD_STORAGE_KEY), false);
  const state = readCampaignWizardState(storage);
  assert.equal(state.step, "goal");
  assert.equal(state.selectedKitId, "bk_1");
  assert.equal(state.goal, "bereik");
});

test("readCampaignWizardState negeert ongeldige waarden", () => {
  const storage = {
    getItem: () =>
      JSON.stringify({ step: "nope", selectedKitId: 42, goal: "invalid" }),
    setItem: () => {},
    removeItem: () => {},
  };
  const state = readCampaignWizardState(storage);
  assert.equal(state.step, "brand");
  assert.equal(state.selectedKitId, null);
  assert.equal(state.goal, "verkoop");
});

test("buildCampaignWizardSearchParams en readCampaignWizardFromSearchParams", () => {
  const params = buildCampaignWizardSearchParams({
    step: "concepts",
    selectedKitId: "bk_abc",
  });
  assert.equal(params.get("step"), "concepts");
  assert.equal(params.get("kit"), "bk_abc");
  const parsed = readCampaignWizardFromSearchParams(params);
  assert.equal(parsed.step, "concepts");
  assert.equal(parsed.selectedKitId, "bk_abc");
});
