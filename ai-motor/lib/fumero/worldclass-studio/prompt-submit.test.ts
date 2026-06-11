import assert from "node:assert/strict";
import test from "node:test";
import {
  canSubmitGeneration,
  resolveEffectivePrompt,
} from "./prompt-submit";

test("resolveEffectivePrompt gebruikt getrimde prompt", () => {
  assert.equal(resolveEffectivePrompt("  hallo  ", 0, "image"), "hallo");
});

test("resolveEffectivePrompt valt terug op edit-default bij refs", () => {
  const p = resolveEffectivePrompt("", 2, "image");
  assert.match(p, /Verbeter deze foto/);
});

test("resolveEffectivePrompt leeg bij video zonder prompt", () => {
  assert.equal(resolveEffectivePrompt("", 1, "video"), "");
});

test("canSubmitGeneration blokkeert bij busy", () => {
  assert.equal(canSubmitGeneration("test", 0, "image", true), false);
});

test("canSubmitGeneration staat toe met prompt", () => {
  assert.equal(canSubmitGeneration("maak een logo", 0, "image", false), true);
});

test("canSubmitGeneration staat toe met refs en image", () => {
  assert.equal(canSubmitGeneration("", 1, "image", false), true);
});
