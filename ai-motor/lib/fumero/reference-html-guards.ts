/** Dashed "Concept" mock — never ship as final tool output. */
export function isDummyPlaceholderHtml(html: string): boolean {
  const t = html.trim();
  if (!t) return true;
  if (/border:\s*1px\s+dashed/i.test(t) && /Concept/i.test(t)) return true;
  if (/mock-label/i.test(t) && /Live preview/i.test(t)) return true;
  if (/Concept\s*—/i.test(t) && !/<script[\s>]/i.test(t)) return true;
  return false;
}
