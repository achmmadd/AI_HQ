/** Normalize scraped price to dot-decimal string (e.g. "24.95"). */
export function normalizePriceString(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim().replace(/[^\d.,]/g, "");
  if (!trimmed) return null;
  const normalized = trimmed.includes(",")
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed;
  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n) || n < 0) return null;
  return n.toFixed(2);
}

/** Display price in Dutch EUR format: €24,95 */
export function formatPriceEur(
  price: string | null | undefined,
  currency = "EUR"
): string | null {
  const normalized = normalizePriceString(price);
  if (!normalized) return null;
  if (currency !== "EUR") return `${normalized} ${currency}`;
  const [whole, frac] = normalized.split(".");
  return `€${whole},${frac ?? "00"}`;
}
