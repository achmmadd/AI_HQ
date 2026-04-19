/** Extracteer uit Factory OS / Dify antwoord de bruikbare App-code. */
export function extractAppCodeFromFactoryOutput(raw: string): string {
  const t = raw.trim();
  const re =
    /```(?:jsx|tsx|js|javascript|react)?\s*\n([\s\S]*?)```/gi;
  let best = "";
  let m: RegExpExecArray | null;
  while ((m = re.exec(t)) !== null) {
    const block = (m[1] ?? "").trim();
    if (
      block.length > best.length &&
      (block.includes("function App") || block.includes("const App"))
    ) {
      best = block;
    }
  }
  if (best) return best;

  let cleaned = t
    .replace(/```(?:jsx|tsx|js|javascript|react)?/gi, "")
    .replace(/```/g, "")
    .trim();
  return cleaned;
}

export function validateAppCode(code: string): { valid: boolean; error?: string } {
  const c = code.trim();
  if (!c || c.length < 40) {
    return { valid: false, error: "Code te kort of leeg" };
  }
  const hasApp =
    /function\s+App\s*\(/.test(c) ||
    /const\s+App\s*=\s*(\([^)]*\)\s*=>|function)/.test(c);
  if (!hasApp) {
    return { valid: false, error: "Geen App-component (function App of const App =) gevonden" };
  }
  if (/^\s*import\s/m.test(c)) {
    return { valid: false, error: "Import statements niet toegestaan" };
  }
  const opens = (c.match(/\{/g) || []).length;
  const closes = (c.match(/\}/g) || []).length;
  if (Math.abs(opens - closes) > 3) {
    return { valid: false, error: "Ongebalanceerde accolades" };
  }
  return { valid: true };
}

/** Voorkom breken van srcDoc / script parsing. */
export function sanitizeCodeForSrcDoc(code: string): string {
  return code.replace(/<\/script>/gi, "<\\/script>");
}
