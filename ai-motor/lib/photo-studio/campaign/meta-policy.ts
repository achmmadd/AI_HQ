/** Meta Ads policy filter — profile-based rules for tenant/branche. */

export type CampaignPolicyProfileId = "default_ecom" | "fumero_hhc";

const SHARED_FORBIDDEN: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\b(geneest|genezen|healing|cure|curative)\b/i, reason: "Gezondheidsclaim (genezen)" },
  { pattern: /\b(pijn\s*stiller|pijnstill|medicijn|medicatie)\b/i, reason: "Medische claim" },
  { pattern: /\b(100\s*%\s*veilig|gegarandeerd\s*resultaat)\b/i, reason: "Absolute garantie" },
  { pattern: /\b(gratis\s*medicijn|recept\s*verplicht)\b/i, reason: "Medische/recept-claim" },
  { pattern: /\b(anti[-\s]?depress|angst\s*weg|slaapprobleem\s*op)\b/i, reason: "Therapeutische claim" },
  { pattern: /\b(kinderen|jeugd|tiener|school)\b/i, reason: "Minderjarigen-doelgroep" },
];

const FUMERO_HHC_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  ...SHARED_FORBIDDEN,
  { pattern: /\b(i\s*deal|creditcard|paypal|visa|mastercard)\b/i, reason: "Onjuiste betaalmethode" },
  {
    pattern: /\b(#\s*)?(cbd|thc|hhc)\s*(is\s*)?(gezond|healthy)\b/i,
    reason: "Gezondheidsclaim cannabinoïde",
  },
  {
    pattern: /\b(niet\s*verslavend|100\s*%\s*natuurlijk\s*en\s*veilig)\b/i,
    reason: "Misleading safety claim",
  },
  { pattern: /(🔥|💯|🚀|✨|😍|🎉)/u, reason: "Emoji in ad copy (merkrichtlijn)" },
];

const DEFAULT_ECOM_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  ...SHARED_FORBIDDEN,
  { pattern: /\b(i\s*deal|creditcard|paypal|visa|mastercard)\b/i, reason: "Betaalmethode niet geverifieerd" },
];

const POLICY_PROFILES: Record<CampaignPolicyProfileId, Array<{ pattern: RegExp; reason: string }>> = {
  default_ecom: DEFAULT_ECOM_PATTERNS,
  fumero_hhc: FUMERO_HHC_PATTERNS,
};

export type MetaPolicyResult = {
  pass: boolean;
  warnings: string[];
  sanitized: string;
};

export function checkMetaPolicy(
  text: string,
  profile: CampaignPolicyProfileId = "default_ecom"
): MetaPolicyResult {
  const warnings: string[] = [];
  const patterns = POLICY_PROFILES[profile] ?? DEFAULT_ECOM_PATTERNS;
  for (const { pattern, reason } of patterns) {
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

export function checkCopySetPolicy(
  fields: Record<string, string>,
  profile: CampaignPolicyProfileId = "default_ecom"
): MetaPolicyResult {
  const combined = Object.values(fields).join("\n");
  return checkMetaPolicy(combined, profile);
}

export function sanitizeHeadline(text: string, maxLen = 40): string {
  let out = text.trim();
  if (out.length > maxLen) {
    out = out.slice(0, maxLen - 1).trimEnd() + "…";
  }
  return out;
}
