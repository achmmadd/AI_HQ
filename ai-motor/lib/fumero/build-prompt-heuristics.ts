/** B2B shop / e-commerce prompts (Fase 4). */
export function isShopPrompt(prompt: string): boolean {
  const p = prompt.toLowerCase();
  return (
    /\b(shop|webshop|winkel|e-?commerce|b2b\s*shop)\b/.test(p) &&
    /\b(checkout|afrekenen|cart|winkelwagen|bestel)\b/.test(p)
  );
}

/** Prompt signals that require multi-page contract (≥2 pages). */
export function isMultiPagePrompt(prompt: string): boolean {
  const p = prompt.toLowerCase();
  if (/\b(meerdere\s+pagina'?s?|multi[- ]?page)\b/.test(p)) return true;
  const pageHits = [
    /\bhome\b/,
    /\bshop\b|\bwinkel\b|\bwebshop\b/,
    /\bcheckout\b|\bafrekenen\b|\bwinkelwagen\b|\bcart\b/,
    /\bdashboard\b|\bbeheer\b|\badmin\b/,
  ].filter((re) => re.test(p)).length;
  return pageHits >= 2;
}
