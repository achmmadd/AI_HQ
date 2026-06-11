import assert from "node:assert/strict";
import test from "node:test";
import { formatFullAppBuildPlan, formatStructuredBuildPlan } from "@/lib/fumero/build-plan";

test("formatStructuredBuildPlan includes doel template interacties feiten", () => {
  const plan = formatStructuredBuildPlan({
    prompt: "Bouw chatbot voor klantvragen",
    templateId: "chat",
    deployType: "widget",
  });
  assert.match(plan, /Doel/);
  assert.match(plan, /Sjabloon/);
  assert.match(plan, /Interacties/);
  assert.match(plan, /Feiten/);
  assert.match(plan, /bankoverschrijving/i);
});

test("formatFullAppBuildPlan includes pages data API and kennisbank feiten", () => {
  const plan = formatFullAppBuildPlan("B2B shop met home shop checkout dashboard");
  assert.match(plan, /Website\/App/);
  assert.match(plan, /Home, Shop, Checkout, Dashboard/);
  assert.match(plan, /data-gedreven app/i);
  assert.match(plan, /api\/apps/i);
  assert.match(plan, /bankoverschrijving/i);
  assert.match(plan, /18 jaar en ouder/i);
});
