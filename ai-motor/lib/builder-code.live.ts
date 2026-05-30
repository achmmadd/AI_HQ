/** Extracteer uit Factory OS / Dify het bruikbare HTML-document. */
export function extractAppCodeFromFactoryOutput(raw: string): string {
  const t = raw.trim();
  const reHtml = /```(?:html|htm)?\s*\n([\s\S]*?)```/gi;
  let best = "";
  let m: RegExpExecArray | null;
  while ((m = reHtml.exec(t)) !== null) {
    const block = (m[1] ?? "").trim();
    if (block.length > best.length) best = block;
  }
  if (best) return best;

  const reAny = /```(?:jsx|tsx|js|javascript|react)?\s*\n([\s\S]*?)```/gi;
  while ((m = reAny.exec(t)) !== null) {
    const block = (m[1] ?? "").trim();
    if (
      block.length > best.length &&
      (/<!DOCTYPE/i.test(block) || /<html[\s>]/i.test(block))
    ) {
      best = block;
    }
  }
  if (best) return best;

  return t
    .replace(/```(?:html|htm|jsx|tsx|js|javascript|react)?/gi, "")
    .replace(/```/g, "")
    .trim();
}

/** Licht transport-/instruction prefix dat soms aan assistanttekst wordt toegevoegd. */
export function stripBuilderTransportMarkers(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/^\s*\[Output:[^\]]*\]\s*\n*/gim, "")
    .trimEnd();
}

/** Verwijdert per ongeluk in de bron belande markdown (**bold**, *italic*). */
export function stripMarkdownFormattingFromCode(code: string): string {
  return code
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1");
}

export type ValidateAppCodeResult =
  | { valid: true; code: string }
  | { valid: false; error: string };

/** BOM / zero-width / NBSP. */
export function scrubInvisibleSourceChars(code: string): string {
  return code
    .replace(/^\uFEFF/, "")
    .replace(/[\u200B-\u200D\uFEFF\u2060]/g, "")
    .replace(/\u00A0/g, " ");
}

/**
 * Zorgt voor een volledig HTML-document voor srcDoc + builder-validatie.
 * Fragmenten (alleen body-inhoud) worden in een minimale shell gezet.
 */
export function normalizeVanillaAppHtml(code: string): string {
  let c = scrubInvisibleSourceChars(code);
  c = stripMarkdownFormattingFromCode(c.trim());
  c = c.replace(/^```(?:html|htm|jsx|tsx|js|javascript|react)?\s*$/gim, "");
  c = c.replace(/^\s*#\s+[^\n]*\n+/, "");
  c = c.trim();

  const looksLikeFullDoc = /<!DOCTYPE/i.test(c) || /<html[\s>]/i.test(c);
  if (!looksLikeFullDoc) {
    c = `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-slate-900 text-slate-100">
${c}
</body>
</html>`;
  }

  return c.trim();
}

export function validateAppCode(code: string): ValidateAppCodeResult {
  let c = code.trim();

  if (/[^"'`]\*\*[^"'`]/.test(c)) {
    return {
      valid: false,
      error: "Gebruik Math.pow() ipv ** operator voor compatibiliteit",
    };
  }

  if (!c || c.length < 80) {
    return { valid: false, error: "HTML te kort of leeg" };
  }

  if (!/<!DOCTYPE/i.test(c) && !/<html[\s>]/i.test(c)) {
    return {
      valid: false,
      error: "Ontbrekend HTML-document (<!DOCTYPE of <html>)",
    };
  }

  if (!/<body[\s>]/i.test(c)) {
    return { valid: false, error: "Ontbrekend <body>" };
  }

  if (!/<script[\s>]/i.test(c)) {
    return {
      valid: false,
      error: "Geen <script>; gebruik vanilla JS in één script-blok",
    };
  }

  if (/type\s*=\s*["']module["']/i.test(c)) {
    return {
      valid: false,
      error: "Geen type=module; gebruik één plain <script> zonder modules",
    };
  }

  if (/^\s*import\s/m.test(c)) {
    return { valid: false, error: "Geen import; gebruik plain script zonder modules" };
  }

  if (/^\s*export\s/m.test(c)) {
    return { valid: false, error: "Geen export in app-HTML" };
  }

  const vanillaHint =
    /document\.(getElementById|createElement|querySelector)|\.addEventListener\s*\(/;
  if (!vanillaHint.test(c)) {
    return {
      valid: false,
      error:
        "Gebruik vanilla DOM-API’s (getElementById, createElement, querySelector, addEventListener)",
    };
  }

  const reactPatterns: [RegExp, string][] = [
    [/\bReact\./, "Geen React (React.*)"],
    [/\bcreateRoot\s*\(/, "Geen React 18 createRoot"],
    [/\bReactDOM\./, "Geen ReactDOM"],
    [/\buseState\s*\(/, "Geen hooks (useState)"],
    [/\buseEffect\s*\(/, "Geen hooks (useEffect)"],
    [/\bfunction\s+App\s*\(/, "Geen React App-component; gebruik plain HTML + JS"],
    [/\bconst\s+App\s*=\s*/, "Geen const App = …; gebruik plain HTML + JS"],
    [/\bcreateElement\s*\(\s*App\s*[,)]/, "Geen React.createElement(App)"],
  ];
  for (const [re, msg] of reactPatterns) {
    if (re.test(c)) return { valid: false, error: msg };
  }

  if (/\s<[A-Z][A-Za-z]{2,}[\s/>]/.test(c)) {
    return {
      valid: false,
      error:
        "Geen JSX-achtige tags met hoofdletter; gebruik HTML + createElement",
    };
  }

  return { valid: true, code: c };
}

/** Legacy naam: zelfde als normalizeVanillaAppHtml (preview + builder). */
export function normalizeAppCodeForPreview(code: string): string {
  return normalizeVanillaAppHtml(code);
}
