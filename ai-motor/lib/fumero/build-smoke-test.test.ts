import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  MIN_UX_PUBLISH_SCORE,
  runBuildSmokeTest,
} from "@/lib/fumero/build-smoke-test";
import { isDummyPlaceholderHtml } from "@/lib/fumero/reference-seeds";

const SEEDS = join(import.meta.dirname ?? __dirname, "seeds");

test("rejects dashed Concept placeholder", () => {
  const html = `<div class="mock" style="border:1px dashed #ccc">Concept preview</div>`;
  assert.equal(isDummyPlaceholderHtml(html), true);
  const smoke = runBuildSmokeTest(html);
  assert.equal(smoke.passed, false);
  assert.ok(smoke.errors.some((e) => /placeholder/i.test(e)));
});

test("chatbot reference passes smoke test", () => {
  const html = readFileSync(join(SEEDS, "chatbot-reference.html"), "utf8");
  const smoke = runBuildSmokeTest(html, { templateId: "chat" });
  assert.equal(smoke.passed, true, smoke.errors.join("; "));
  assert.ok(smoke.uxScore >= MIN_UX_PUBLISH_SCORE);
});

test("flappy reference passes smoke test", () => {
  const html = readFileSync(join(SEEDS, "flappy-arcade.html"), "utf8");
  const smoke = runBuildSmokeTest(html, { isGame: true });
  assert.equal(smoke.passed, true, smoke.errors.join("; "));
});

test("rejects HTML without interactivity", () => {
  const html = `<!DOCTYPE html><html lang="nl"><head><title>x</title><meta name="viewport" content="width=device-width"/></head><body><p>statisch</p></body></html>`;
  const smoke = runBuildSmokeTest(html);
  assert.equal(smoke.passed, false);
  assert.ok(smoke.errors.some((e) => /script|interactief|handlers/i.test(e)));
});
