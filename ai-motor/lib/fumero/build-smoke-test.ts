import {
  checkJsSyntaxWithNode,
  extractScriptBodies,
  validateGeneratedHtml,
} from "@/lib/fumero/build-validation";
import { isDummyPlaceholderHtml } from "@/lib/fumero/reference-seeds";
import { runRuleBasedUxCheck } from "@/lib/connectors/specialists";

export const MIN_UX_PUBLISH_SCORE = 70;

export type SmokeTestResult = {
  passed: boolean;
  errors: string[];
  uxScore: number;
  uxFailedItems: string[];
};

function countInteractiveControls(html: string): number {
  const buttons = (html.match(/<button\b/gi) ?? []).length;
  const inputs = (html.match(/<input\b/gi) ?? []).length;
  const canvas = /<canvas[\s>]/i.test(html) ? 1 : 0;
  return buttons + inputs + canvas;
}

function detectObviousJsIssues(script: string): string[] {
  const errors: string[] = [];
  if (/console\.error\s*\(/.test(script) && /throw\s+new\s+Error/.test(script)) {
    errors.push("Script bevat expliciete error-handlers die op runtime-fouten wijzen");
  }
  if (/undefined is not a function/i.test(script)) {
    errors.push("Script bevat bekende runtime-fouttekst");
  }
  if (/\.innerHTML\s*=\s*[^;]+(?:inp|input|query)/i.test(script)) {
    errors.push("Gebruikersinvoer via innerHTML — gebruik textContent");
  }
  return errors;
}

/**
 * Lightweight headless smoke test (no browser). Playwright path is optional for CI.
 */
export function runBuildSmokeTest(
  html: string,
  opts?: { templateId?: string; isGame?: boolean }
): SmokeTestResult {
  const errors: string[] = [];

  if (isDummyPlaceholderHtml(html)) {
    errors.push("Placeholder-HTML gedetecteerd — geen definitieve tool-output");
  }

  const validation = validateGeneratedHtml(html, opts?.templateId, {
    isGame: opts?.isGame,
  });
  if (!validation.valid) {
    errors.push(...validation.errors);
  }

  const scripts = extractScriptBodies(html);
  const script = scripts.join("\n\n");
  if (script) {
    errors.push(...detectObviousJsIssues(script));
    const syntaxErr = checkJsSyntaxWithNode(script);
    if (syntaxErr) {
      errors.push(`JavaScript syntax: ${syntaxErr.split("\n")[0]}`);
    }
  }

  const controls = countInteractiveControls(html);
  if (controls === 0) {
    errors.push("Geen interactieve elementen (knoppen, inputs of canvas)");
  }

  const hasHandler =
    /addEventListener/i.test(script) ||
    /\bonclick\s*=/i.test(html) ||
    /requestAnimationFrame/i.test(script);
  if (!hasHandler) {
    errors.push("Geen werkende event-handlers in script");
  }

  const ux = runRuleBasedUxCheck(html);
  const uxFailedItems = ux.items.filter((i) => !i.pass).map((i) => i.label);
  if (ux.score < MIN_UX_PUBLISH_SCORE) {
    errors.push(
      `UX-score te laag (${ux.score}/${MIN_UX_PUBLISH_SCORE} minimaal) — ${uxFailedItems.slice(0, 3).join(", ")}`
    );
  }

  const unique = [...new Set(errors)];
  return {
    passed: unique.length === 0,
    errors: unique,
    uxScore: ux.score,
    uxFailedItems,
  };
}

