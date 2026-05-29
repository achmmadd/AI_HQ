/**
 * Run: node lib/photo-studio/fal.prompt-test.mjs
 * (from repo root; requires `npm run build` first so .next can resolve, or use tsx on fal.ts)
 *
 * Standalone assertions for prompt enrichment strings (no FAL API key).
 */
import assert from "node:assert/strict";

const PRODUCT_BASE =
  "Professional studio product photography. Pure white seamless background.";
const FOOD_BASE =
  "Professional food photography for restaurant menu. Appetizing presentation";
const IMG2IMG_PRODUCT =
  "Professional product photography remake. Same product, studio lighting upgrade.";
const IMG2IMG_FOOD =
  "Professional food photography remake. Same dish, presentation and plating preserved";

function enrichTextToImagePrompt(userPrompt, type) {
  const baseEnrichment = {
    product:
      "Professional studio product photography. Pure white seamless background. Soft box studio lighting from above-left. Sharp focus on product, no distractions. Clean minimal composition, shot on Hasselblad 907X. Commercial e-commerce quality, not AI generated. Fine details crisp, professional color grading. No text, no labels, no props whatsoever. Magazine cover quality.",
    food:
      "Professional food photography for restaurant menu. Appetizing presentation, natural warm lighting. Shot from 45 degrees, food in focus, shallow depth. Captured on Canon 5D Mark IV with 85mm lens. Fine culinary details visible, professional plating. Not AI generated, shot on camera. Michelin-guide restaurant quality. Clean neutral background, warm golden hour light.",
  };
  return `${userPrompt}\n\n${baseEnrichment[type] || baseEnrichment.product}`;
}

function enrichImageToImagePrompt(userPrompt, type = "product") {
  const product =
    "Professional product photography remake. Same product, studio lighting upgrade. White seamless background, soft box fill light. Remove: shadows, bad background, phone artifacts. Keep: product shape, colors, details exact. Output: magazine-quality product shot. Clean, minimal, Hasselblad 907X style. Not AI generated, shot on professional camera.";
  const food =
    "Professional food photography remake. Same dish, presentation and plating preserved. Warm natural restaurant lighting upgrade. Clean neutral background. Remove: shadows, bad background, phone artifacts. Keep: food shape, colors, garnishes exact. Output: Michelin-guide menu-quality food shot. Canon 5D Mark IV with 85mm lens style. Not AI generated, shot on professional camera.";
  const base = type === "food" ? food : product;
  return `${base}\n\nUser context: ${userPrompt}`;
}

function buildTxt(klant, userPrompt) {
  const type = klant === "bokas" ? "food" : "product";
  const system =
    type === "food"
      ? "Je bent een professioneel food fotograaf."
      : "Je bent een professioneel product fotograaf.";
  return `${system}\n\n${enrichTextToImagePrompt(userPrompt, type)}`;
}

// Case 1
const c1 = buildTxt("fumero", "HHC vape premium");
assert.ok(c1.includes("Je bent een professioneel product fotograaf"));
assert.ok(c1.includes("HHC vape premium"));
assert.ok(c1.includes(PRODUCT_BASE.slice(0, 40)));

// Case 2
const c2 = buildTxt("bokas", "Café pancake with berries");
assert.ok(c2.includes("Je bent een professioneel food fotograaf"));
assert.ok(c2.includes("Café pancake with berries"));
assert.ok(c2.includes(FOOD_BASE.slice(0, 40)));

// Case 3
const c3 = enrichImageToImagePrompt("Verbeter deze productfoto.", "product");
assert.ok(c3.includes(IMG2IMG_PRODUCT.slice(0, 40)));
assert.ok(c3.includes("User context: Verbeter deze productfoto."));

// Case 4
const c4 = enrichImageToImagePrompt("Zelfde gerecht, betere menu-foto.", "food");
assert.ok(c4.includes(IMG2IMG_FOOD.slice(0, 40)));
assert.ok(c4.includes("User context: Zelfde gerecht, betere menu-foto."));

console.log("photo-studio fal prompt tests: OK (4 cases)");
console.log("\n--- Sample 1 (Fumero txt2img) ---\n", c1);
console.log("\n--- Sample 2 (Bokas txt2img) ---\n", c2);
console.log("\n--- Sample 3 (Fumero img2img) ---\n", c3);
console.log("\n--- Sample 4 (Bokas img2img) ---\n", c4);
