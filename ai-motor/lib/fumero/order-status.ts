export type FumeroOrderStatus = "nieuw" | "verwerking" | "verzonden";

export function parseOrderStatus(rawSummary: string | null | undefined): FumeroOrderStatus {
  const raw = (rawSummary ?? "").toLowerCase();
  if (
    /\b(verzonden|shipped|completed|afgeleverd|delivered|bezorgd)\b/.test(raw)
  ) {
    return "verzonden";
  }
  if (
    /\b(verwerking|processing|in behandeling|on-hold|wacht|pending payment|betaald)\b/.test(
      raw
    )
  ) {
    return "verwerking";
  }
  return "nieuw";
}

export function orderStatusLabel(s: FumeroOrderStatus): string {
  if (s === "verzonden") return "Verzonden";
  if (s === "verwerking") return "Verwerking";
  return "Nieuw";
}
