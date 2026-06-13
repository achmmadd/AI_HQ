import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { join } from "node:path";
import {
  autoFixGeneratedHtml,
  BROKEN_FLAPPY_PATTERNS,
  formatValidationRetryHint,
  isGamePrompt,
  validateGeneratedHtml,
} from "@/lib/fumero/build-validation";
import {
  isDummyPlaceholderHtml,
  loadChatbotReferenceSeed,
  loadFlappyReferenceSeed,
} from "@/lib/fumero/reference-seeds";

const SEEDS = join(import.meta.dirname ?? __dirname, "seeds");

function brokenFlappyHtml(overrides?: {
  css?: string;
  scriptExtra?: string;
  scriptReplace?: [string, string];
  truncateScriptAt?: string;
  brandText?: string;
}): string {
  let script = `
(function () {
  var W = 480, H = 520;
  var canvas = document.createElement('canvas');
  ${BROKEN_FLAPPY_PATTERNS.mathRandomMissingStar}
  ${BROKEN_FLAPPY_PATTERNS.mathRandomRange}
  function loop() { requestAnimationFrame(loop); }
  canvas.addEventListener('click', function () {});
  ${overrides?.scriptExtra ?? ""}
})();
`.trim();

  if (overrides?.scriptReplace) {
    script = script.replace(overrides.scriptReplace[0], overrides.scriptReplace[1]);
  }
  if (overrides?.truncateScriptAt) {
    const idx = script.indexOf(overrides.truncateScriptAt);
    if (idx >= 0) script = script.slice(0, idx + overrides.truncateScriptAt.length);
  }

  const css =
    overrides?.css ??
    `${BROKEN_FLAPPY_PATTERNS.cssMissingStar} canvas { display: block; }`;
  const brand = overrides?.brandText ?? BROKEN_FLAPPY_PATTERNS.brandUw;

  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"/><style>${css}</style></head>
<body>
<canvas id="gameCanvas"></canvas>
<p>${brand}</p>
<script>${script}</script>
</body>
</html>`;
}

test("validates working flappy reference seed", () => {
  const html =
    loadFlappyReferenceSeed() ??
    readFileSync(join(SEEDS, "flappy-arcade.html"), "utf8");
  const result = validateGeneratedHtml(html, undefined, { isGame: true });
  assert.equal(result.valid, true, result.errors.join("; "));
});

test("validates chatbot reference seed with KB object", () => {
  const html =
    loadChatbotReferenceSeed() ??
    readFileSync(join(SEEDS, "chatbot-reference.html"), "utf8");
  const result = validateGeneratedHtml(html, "chat");
  assert.equal(result.valid, true, result.errors.join("; "));
  assert.match(html, /const KB = \{/);
  assert.match(html, /bankoverschrijving/i);
  assert.ok(!/iDEAL/i.test(html) || /geen iDEAL/i.test(html) || /crypto/i.test(html));
});

test("detects dummy placeholder HTML", () => {
  const html = readFileSync(join(SEEDS, "chatbot-reference.html"), "utf8");
  assert.equal(isDummyPlaceholderHtml(html), false);
  assert.equal(
    isDummyPlaceholderHtml('<div style="border:1px dashed">Concept</div>'),
    true
  );
});

test("rejects CSS missing universal selector", () => {
  const result = validateGeneratedHtml(brokenFlappyHtml(), undefined, { isGame: true });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /CSS-selector mist universele/i.test(e)));
});

test("rejects Math.random() missing multiply operator", () => {
  const result = validateGeneratedHtml(brokenFlappyHtml(), undefined, { isGame: true });
  assert.ok(
    result.errors.some((e) => /Math\.random/i.test(e)),
    result.errors.join("; ")
  );
});

test("rejects truncated collision check", () => {
  const html = brokenFlappyHtml({
    scriptExtra: `function check() { ${BROKEN_FLAPPY_PATTERNS.truncatedCollision}`,
    truncateScriptAt: BROKEN_FLAPPY_PATTERNS.truncatedCollision,
  });
  const result = validateGeneratedHtml(html, undefined, { isGame: true });
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some(
      (e) =>
        /afgekapt/i.test(e) ||
        /ongebalanceerde/i.test(e) ||
        /syntax/i.test(e)
    ),
    result.errors.join("; ")
  );
});

test("rejects brand voice 'bouw uw score op'", () => {
  const result = validateGeneratedHtml(brokenFlappyHtml(), undefined, { isGame: true });
  assert.ok(result.errors.some((e) => /bouw je score/i.test(e)));
});

test("rejects game without requestAnimationFrame", () => {
  const html = brokenFlappyHtml({
    scriptReplace: ["requestAnimationFrame(loop);", "// no loop"],
  });
  const result = validateGeneratedHtml(html, undefined, { isGame: true });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /game-loop|requestAnimationFrame/i.test(e)));
});

test("rejects game without input handlers", () => {
  const html = brokenFlappyHtml({
    scriptReplace: ["canvas.addEventListener('click', function () {});", ""],
  });
  const result = validateGeneratedHtml(html, undefined, { isGame: true });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /input-handlers/i.test(e)));
});

test("rejects script shorter than 500 chars for games", () => {
  const html = `<!DOCTYPE html><html><head><style>*{box-sizing:border-box}</style></head>
<body><canvas></canvas><script>
(function(){var c=document.querySelector('canvas');function loop(){requestAnimationFrame(loop);}
c.addEventListener('click',function(){});loop();})();
</script></body></html>`;
  const result = validateGeneratedHtml(html, undefined, { isGame: true });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /te kort/i.test(e)));
});

test("rejects missing </html>", () => {
  const html = "<!DOCTYPE html><html><body><script>var x=1;</script></body>";
  const result = validateGeneratedHtml(html);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => /html/i.test(e)));
});

test("isGamePrompt detects arcade prompts", () => {
  assert.equal(isGamePrompt("Bouw een flappy arcade game"), true);
  assert.equal(isGamePrompt("FAQ chatbot over verzending"), false);
});

test("autoFix repairs CSS universal selector and Math.random multiply", () => {
  const broken = brokenFlappyHtml();
  const fixed = autoFixGeneratedHtml(broken);
  assert.ok(fixed.fixes.length > 0);
  assert.ok(!/^\s*,\s*::before/m.test(fixed.html));
  assert.match(fixed.html, /Math\.random\(\)\s*\*/);
});

test("autoFix + validate accepts repaired calculator-style widget", () => {
  const html = `<!DOCTYPE html>
<html lang="nl"><head><meta charset="UTF-8"/>
<style>${BROKEN_FLAPPY_PATTERNS.cssMissingStar} button { padding: 8px; }</style>
</head><body>
<div id="display">0</div>
<button id="plus">+</button><button id="minus">-</button>
<script>
(function () {
  var display = document.getElementById('display');
  var val = 0;
  document.getElementById('plus').addEventListener('click', function () {
    val = val + 1;
    display.textContent = String(val);
  });
  document.getElementById('minus').addEventListener('click', function () {
    val = val - 1;
    display.textContent = String(val);
  });
})();
</script></body></html>`;
  const fixed = autoFixGeneratedHtml(html);
  const result = validateGeneratedHtml(fixed.html, "calculator");
  assert.equal(result.valid, true, result.errors.join("; "));
});

test("autoFix injects handlers when buttons exist without JS", () => {
  const html = `<!DOCTYPE html><html><head><style>*{box-sizing:border-box}</style></head>
<body><button type="button">CTA</button></body></html>`;
  const fixed = autoFixGeneratedHtml(html);
  assert.match(fixed.html, /addEventListener/);
  const result = validateGeneratedHtml(fixed.html, "landing");
  assert.equal(result.valid, true, result.errors.join("; "));
});

test("formatValidationRetryHint lists errors", () => {
  const hint = formatValidationRetryHint(["fout A", "fout B"]);
  assert.match(hint, /fout A/);
  assert.match(hint, /fout B/);
  assert.match(hint, /VOLLEDIGE HTML/);
});
