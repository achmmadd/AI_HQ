import { execFileSync } from "node:child_process";
import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  normalizeVanillaAppHtml,
  scrubInvisibleSourceChars,
  validateAppCode,
} from "@/lib/builder-code";
import { loadFlappyReferenceSeed } from "@/lib/fumero/reference-seeds";

export { loadFlappyReferenceSeed };

export type ValidateHtmlOptions = {
  /** Stricter checks for canvas games (loop, input, min script size). */
  isGame?: boolean;
};

export type ValidateHtmlResult = {
  valid: boolean;
  errors: string[];
};

const GAME_TEMPLATE_IDS = new Set(["flappy", "game", "arcade"]);

/** Broken Max output patterns — sample fixtures for tests and heuristics. */
export const BROKEN_FLAPPY_PATTERNS = {
  cssMissingStar: ", ::before, ::after { box-sizing: border-box; }",
  mathRandomMissingStar: "var x = Math.random()  W;",
  mathRandomRange: "var topH = minTop + Math.random()  (maxTop - minTop);",
  mathPiMissingStar: "ctx.arc(s.x, s.y, s.r, 0, Math.PI  2);",
  mathCosMissingStar: "vx: Math.cos(ang)  speed,",
  truncatedCollision: "if (bx + br > p.x &",
  brandUw: "bouw uw score op",
} as const;

export function isGamePrompt(prompt: string): boolean {
  return /\b(flappy|game|spel|snake|pong|tetris|arcade|canvas)\b/i.test(prompt);
}

export function isGameHtml(html: string): boolean {
  return (
    /<canvas[\s>]/i.test(html) &&
    (/requestAnimationFrame/i.test(html) ||
      /\b(gameLoop|STATE_PLAYING|flappy|arcade|spawnPipe)\b/i.test(html))
  );
}

export function shouldValidateAsGame(
  html: string,
  templateId?: string,
  opts?: ValidateHtmlOptions
): boolean {
  if (opts?.isGame) return true;
  if (templateId && GAME_TEMPLATE_IDS.has(templateId)) return true;
  return isGameHtml(html);
}

export function extractScriptBodies(html: string): string[] {
  const scripts: string[] = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const attrs = match[1] ?? "";
    if (/type\s*=\s*["']module["']/i.test(attrs)) continue;
    const body = (match[2] ?? "").trim();
    if (body) scripts.push(body);
  }
  return scripts;
}

export function checkJsSyntaxWithNode(js: string): string | null {
  const tmp = join(tmpdir(), `fumero-validate-${process.pid}-${Date.now()}.js`);
  try {
    writeFileSync(tmp, js, "utf8");
    execFileSync("node", ["--check", tmp], { encoding: "utf8", stdio: "pipe" });
    return null;
  } catch (e) {
    const err = e as { stderr?: string; message?: string };
    return (err.stderr || err.message || "JavaScript syntaxfout").trim();
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function detectLlmSyntaxBugs(script: string): string[] {
  const errors: string[] = [];

  if (/Math\.random\(\)\s+[A-Za-z(]/.test(script)) {
    errors.push("Ontbrekende * bij Math.random() (bijv. Math.random() * W)");
  }
  if (/Math\.PI\s+\d/.test(script)) {
    errors.push("Ontbrekende * bij Math.PI (bijv. Math.PI * 2)");
  }
  if (/Math\.(cos|sin)\([^)]+\)\s+[a-zA-Z0-9_(]/.test(script)) {
    errors.push("Ontbrekende * bij Math.cos/sin vermenigvuldiging");
  }
  if (/\bif\s*\([^)]*&\s*$/.test(script.trim())) {
    errors.push("Script afgekapt midden in conditie (onvolledige &&)");
  }
  if (/\b&\s*$/.test(script.trim())) {
    errors.push("Script eindigt met & zonder && (afgekapt)");
  }

  return errors;
}

function detectBalancedScriptTags(html: string): string[] {
  const errors: string[] = [];
  const opens = (html.match(/<script\b/gi) ?? []).length;
  const closes = (html.match(/<\/script>/gi) ?? []).length;
  if (opens !== closes) {
    errors.push(`Ongebalanceerde <script>-tags (${opens} open, ${closes} dicht)`);
  }
  return errors;
}

function detectCssBugs(html: string): string[] {
  const errors: string[] = [];
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let match: RegExpExecArray | null;
  while ((match = styleRe.exec(html))) {
    const css = match[1] ?? "";
    if (/^\s*,\s*::before/m.test(css)) {
      errors.push(
        'CSS-selector mist universele * (", ::before" i.p.v. "*, ::before")'
      );
      break;
    }
  }
  return errors;
}

function detectTruncation(html: string, script: string): string[] {
  const errors: string[] = [];

  if (!/<\/html>\s*$/i.test(html.trim())) {
    errors.push("Document mist sluitende </html>-tag");
  }
  if (/\.\.\.\s*(rest|code|van|hier)/i.test(html)) {
    errors.push("Truncatie-markering gevonden (... rest/code)");
  }

  const openBraces = (script.match(/\{/g) ?? []).length;
  const closeBraces = (script.match(/\}/g) ?? []).length;
  if (openBraces !== closeBraces) {
    errors.push(
      `Script heeft ongebalanceerde accolades (${openBraces} open, ${closeBraces} dicht)`
    );
  }

  const openParens = (script.match(/\(/g) ?? []).length;
  const closeParens = (script.match(/\)/g) ?? []).length;
  if (openParens !== closeParens) {
    errors.push("Script heeft ongebalanceerde haakjes");
  }

  const lastLine = script.trim().split("\n").pop()?.trim() ?? "";
  if (
    lastLine &&
    openBraces === closeBraces &&
    openParens === closeParens &&
    /\b(if|for|while|function)\s*\([^)]*$/.test(lastLine)
  ) {
    errors.push(`Script lijkt afgekapt op regel: "${lastLine.slice(0, 60)}"`);
  }

  return errors;
}

function detectBrandIssues(html: string): string[] {
  const errors: string[] = [];
  if (/bouw uw score op/i.test(html)) {
    errors.push('Brand voice: gebruik "bouw je score op", niet "bouw uw score op"');
  }
  return errors;
}

function detectWidgetInteractivity(
  html: string,
  script: string,
  templateId?: string
): string[] {
  const errors: string[] = [];
  const hasInteractivity =
    /addEventListener/i.test(script) ||
    /\bonclick\s*=/i.test(html) ||
    /\.onclick\s*=/.test(script) ||
    /requestAnimationFrame/i.test(script);
  if (hasInteractivity) return errors;

  if (templateId === "landing") {
    const hasCta =
      /<button\b/i.test(html) ||
      /<form\b/i.test(html) ||
      /<a\b[^>]*href\s*=\s*["']#/.test(html);
    if (hasCta) return errors;
  }

  if (!hasInteractivity) {
    errors.push(
      "Widget mist interactiviteit (addEventListener, onclick of requestAnimationFrame)"
    );
  }
  return errors;
}

export type AutoFixGeneratedHtmlResult = {
  html: string;
  fixes: string[];
};

/** Herstel veelvoorkomende LLM-syntaxfouten vóór strikte validatie. */
export function autoFixGeneratedHtml(html: string): AutoFixGeneratedHtmlResult {
  const fixes: string[] = [];
  let out = scrubInvisibleSourceChars(html.trim());

  out = out.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, open, css, close) => {
    let fixedCss = css as string;
    if (/^\s*,\s*::before/m.test(fixedCss)) {
      fixedCss = fixedCss.replace(/^\s*,\s*::before/m, "*, ::before");
      fixes.push("CSS universele *-selector hersteld");
    }
    fixedCss = fixedCss.replace(
      /(^|[\n\r])\s*,\s*(::before|::after)/g,
      "$1*, $2"
    );
    return `${open}${fixedCss}${close}`;
  });

  out = out.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (_m, open, body, close) => {
    let script = body as string;
    const before = script;
    script = script.replace(/Math\.random\(\)\s+([A-Za-z(])/g, "Math.random() * $1");
    script = script.replace(/Math\.PI\s+(\d)/g, "Math.PI * $1");
    script = script.replace(
      /Math\.(cos|sin)\(([^)]+)\)\s+([a-zA-Z0-9_(])/g,
      "Math.$1($2) * $3"
    );
    if (script !== before) {
      fixes.push("Ontbrekende *-operators in script hersteld");
    }
    return `${open}${script}${close}`;
  });

  if (/bouw uw score op/i.test(out)) {
    out = out.replace(/bouw uw score op/gi, "bouw je score op");
    fixes.push("Brand voice gecorrigeerd (je/jij)");
  }

  if (!/<\/html>\s*$/i.test(out.trim()) && /<html[\s>]/i.test(out)) {
    if (!/<\/body>/i.test(out)) out += "\n</body>";
    out += "\n</html>";
    fixes.push("Sluitende </html>-tag toegevoegd");
  }

  out = normalizeVanillaAppHtml(out);

  let scripts = extractScriptBodies(out);
  const script = scripts.join("\n\n");
  const hasHandler =
    /addEventListener/i.test(script) ||
    /\bonclick\s*=/i.test(out) ||
    /requestAnimationFrame/i.test(script);
  const needsControls =
    /<button\b/i.test(out) ||
    /<input\b/i.test(out) ||
    /<form\b/i.test(out) ||
    /<a\b[^>]*href\s*=\s*["']#/.test(out);
  const needsScript = scripts.length === 0 || (!hasHandler && needsControls);

  if (needsScript && /<body[\s>]/i.test(out)) {
    const patch = `<script>
(function () {
  document.querySelectorAll('button, input[type="button"], input[type="submit"]').forEach(function (el) {
    if (el.dataset.bound) return;
    el.dataset.bound = '1';
    el.addEventListener('click', function () { el.classList.toggle('is-active'); });
  });
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    if (a.dataset.bound) return;
    a.dataset.bound = '1';
    a.addEventListener('click', function (e) {
      var id = (a.getAttribute('href') || '').slice(1);
      var target = id ? document.getElementById(id) : null;
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
    });
  });
})();
</script>`;
    if (/<\/body>/i.test(out)) {
      out = out.replace(/<\/body>/i, `${patch}\n</body>`);
    } else {
      out += patch;
    }
    fixes.push(
      scripts.length === 0
        ? "Ontbrekend script-blok toegevoegd"
        : "Minimale interactiviteit toegevoegd voor knoppen/links"
    );
    scripts = extractScriptBodies(out);
  }

  return { html: out, fixes: [...new Set(fixes)] };
}

function detectGameCompleteness(html: string, script: string): string[] {
  const errors: string[] = [];

  if (script.length < 500) {
    errors.push(`Game-script te kort (${script.length} tekens; minimaal 500)`);
  }
  if (!/requestAnimationFrame\s*\(/i.test(script)) {
    errors.push("Game mist requestAnimationFrame-aanroep");
  }
  if (
    !/addEventListener/i.test(script) &&
    !/\bonclick\s*=/i.test(html) &&
    !/\.onclick\s*=/.test(script)
  ) {
    errors.push("Game mist input-handlers (addEventListener of onclick)");
  }
  if (!/<canvas[\s>]/i.test(html)) {
    errors.push("Game mist <canvas>-element");
  }

  return errors;
}

/**
 * P0 validation for LLM-generated Fumero HTML (widgets, games).
 */
export function validateGeneratedHtml(
  html: string,
  templateId?: string,
  opts?: ValidateHtmlOptions
): ValidateHtmlResult {
  const errors: string[] = [];
  const trimmed = html.trim();

  if (!trimmed) {
    return { valid: false, errors: ["Lege HTML"] };
  }

  if (!/<\/html>/i.test(trimmed)) {
    errors.push("Document mist </html>");
  }

  errors.push(...detectBalancedScriptTags(trimmed));

  const scripts = extractScriptBodies(trimmed);
  if (scripts.length === 0) {
    errors.push("Geen <script>-blok met inhoud gevonden");
  }

  const script = scripts.join("\n\n");
  errors.push(...detectCssBugs(trimmed));
  errors.push(...detectBrandIssues(trimmed));

  const runtimeCheck = validateAppCode(trimmed);
  if (!runtimeCheck.valid) {
    const skipDomOnly =
      runtimeCheck.error.includes("vanilla DOM") ||
      runtimeCheck.error.includes("getElementById");
    if (!skipDomOnly) {
      errors.push(runtimeCheck.error);
    }
  }

  if (script) {
    if (script.length < 80) {
      errors.push("Script-inhoud te kort voor een werkende widget");
    }

    errors.push(...detectTruncation(trimmed, script));
    errors.push(...detectLlmSyntaxBugs(script));

    const syntaxErr = checkJsSyntaxWithNode(script);
    if (syntaxErr) {
      errors.push(`JavaScript syntax: ${syntaxErr.split("\n")[0]}`);
    }
  }

  const asGame = shouldValidateAsGame(trimmed, templateId, opts);
  if (asGame) {
    errors.push(...detectGameCompleteness(trimmed, script));
  } else if (script) {
    errors.push(...detectWidgetInteractivity(trimmed, script, templateId));
  }

  const unique = [...new Set(errors)];
  return { valid: unique.length === 0, errors: unique };
}

export function formatValidationRetryHint(errors: string[]): string {
  return [
    "VALIDATIE MISLUKT — los deze fouten op en lever opnieuw het VOLLEDIGE HTML-document:",
    ...errors.map((e) => `- ${e}`),
    "Controleer: alle *-operators bij Math.random()/Math.PI/Math.cos, CSS *-selector, volledige collision/game-loop, addEventListener op canvas/knoppen, sluitende tags.",
  ].join("\n");
}

/** Preview gate: whether stored tool HTML passes P0 validation. */
export function isToolPreviewInteractive(
  code: string,
  templateId?: string | null,
  prompt?: string | null
): { interactive: boolean; errors: string[] } {
  const result = validateGeneratedHtml(code, templateId ?? undefined, {
    isGame: isGamePrompt(prompt ?? ""),
  });
  return { interactive: result.valid, errors: result.errors };
}
