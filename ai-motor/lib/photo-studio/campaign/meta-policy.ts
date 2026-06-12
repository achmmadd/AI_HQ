/** Meta Ads policy filter — forbidden claims and risky phrases for Fumero. */

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(geneest|genezen|healing|cure|curative)\b/i, reason: "Gezondheidsclaim (genezen)" },
  { pattern: /\b(pijn\s*stiller|pijnstill|medicijn|medicatie)\b/i, reason: "Medische claim" },
  { pattern: /\b(100\s*%\s*veilig|gegarandeerd\s*resultaat)\b/i, reason: "Absolute garantie" },
  { pattern: /\b(i\s*deal|creditcard|paypal|visa|mastercard)\b/i, reason: "Onjuiste betaalmethode" },
  { pattern: /\b(gratis\s*medicijn|recept\s*verplicht)\b/i, reason: "Medische/recept-claim" },
  { pattern: /\b(anti[-\s]?depress|angst\s*weg|slaapprobleem\s*op)\b/i, reason: "Therapeutische claim" },
  { pattern: /\b(#\s*)?(cbd|thc|hhc)\s*(is\s*)?(gezond|healthy)\b/i, reason: "Gezondheidsclaim cannabinoïde" },
  { pattern: /\b(niet\s*verslavend|100\s*%\s*natuurlijk\s*en\s*veilig)\b/i, reason: "Misleading safety claim" },
  { pattern: /\b(kinderen|jeugd|tiener|school)\b/i, reason: "Minderjarigen-doelgroep" },
  { pattern: /\b(🔥|💯|🚀|✨|😍|🎉)/u, reason: "Emoji in ad copy (Fumero brand)" },
];

export type MetaPolicyResult = {
  pass: boolean;
  warnings: string[];
  sanitized: string;
};

export function checkMetaPolicy(text: string): MetaPolicyResult {
  const warnings: string[] = [];
  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      warnings.push(reason);
    }
  }
  return {
    pass: warnings.length === 0,
    warnings,
    sanitized: text.trim(),
  };
}

export function checkCopySetPolicy(fields: Record<string, string>): MetaPolicyResult {
  const combined = Object.values(fields).join("\n");
  return checkMetaPolicy(combined);
}

export function sanitizeHeadline(text: string, maxLen = 40): string {
  let out = text.trim();
  if (out.length > maxLen) {
    out = out.slice(0, maxLen - 1).trimEnd() + "…";
  }
  return out;
}
