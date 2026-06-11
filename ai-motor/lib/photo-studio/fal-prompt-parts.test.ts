import assert from "node:assert/strict";
import test from "node:test";
import {
  buildImageToImagePromptParts,
  buildTextToImagePromptParts,
} from "@/lib/photo-studio/fal";

test("txt2img without brand enhancement passes prompt directly", () => {
  const parts = buildTextToImagePromptParts({
    userPrompt: "een rode sportauto bij zonsondergang",
    klant: "fumero",
    brandEnhancement: false,
  });
  assert.equal(parts.prompt, "een rode sportauto bij zonsondergang");
  assert.equal(parts.fal_prompt, "een rode sportauto bij zonsondergang");
  assert.equal(parts.system_prompt, "");
  assert.ok(!parts.fal_prompt.includes("product fotograaf"));
});

test("txt2img with brand enhancement adds studio context", () => {
  const parts = buildTextToImagePromptParts({
    userPrompt: "HHC vape premium",
    klant: "fumero",
    brandEnhancement: true,
  });
  assert.ok(parts.fal_prompt.includes("HHC vape premium"));
  assert.ok(parts.fal_prompt.includes("product fotograaf"));
  assert.ok(parts.fal_prompt.includes("Professional studio product photography"));
});

test("img2img without brand enhancement passes user context only", () => {
  const parts = buildImageToImagePromptParts({
    userPrompt: "maak achtergrond blauw",
    klant: "fumero",
    brandEnhancement: false,
  });
  assert.equal(parts.prompt, "maak achtergrond blauw");
  assert.ok(!parts.prompt.includes("product photography remake"));
});
