/** USD → EUR voor usage logging (configureerbaar). */
export function usdToEur(usd: number): number {
  const rate = Number(process.env.EUR_PER_USD) || 0.92;
  return Math.round(usd * rate * 100_000) / 100_000;
}
