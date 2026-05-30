import db from "@/lib/db/database";
import { ensurePlatformSchema } from "@/lib/db/platform-schema";
import { usdToEur } from "@/lib/eur-cost";

export type BudgetStatus = {
  klant: string;
  limitEur: number;
  spentEur: number;
  pct: number;
  overBudget: boolean;
  nearLimit: boolean;
};

export function getUsageBudgetStatus(klant: string): BudgetStatus | null {
  ensurePlatformSchema();
  const row = db
    .prepare(`SELECT * FROM usage_budgets WHERE klant = ?`)
    .get(klant) as
    | { monthly_eur_limit: number; alert_threshold_pct: number }
    | undefined;
  if (!row) return null;

  const spent = db
    .prepare(
      `SELECT COALESCE(SUM(COALESCE(cost_eur, cost_usd)), 0) as total
       FROM usage_logs
       WHERE klant = ? AND datetime(created_at) >= datetime('now', 'start of month')`
    )
    .get(klant) as { total: number };
  const spentEur = Number(spent.total) || 0;
  const limitEur = Number(row.monthly_eur_limit) || 50;
  const pct = limitEur > 0 ? (spentEur / limitEur) * 100 : 0;
  const threshold = Number(row.alert_threshold_pct) || 80;

  return {
    klant,
    limitEur,
    spentEur,
    pct,
    overBudget: spentEur >= limitEur,
    nearLimit: pct >= threshold && spentEur < limitEur,
  };
}

export function checkBudgetBeforeUsage(klant: string | null | undefined): {
  allowed: boolean;
  status: BudgetStatus | null;
} {
  if (!klant?.trim()) return { allowed: true, status: null };
  const status = getUsageBudgetStatus(klant.trim());
  if (!status) return { allowed: true, status: null };
  return { allowed: !status.overBudget, status };
}

export function estimateCostEur(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const costs: Record<string, { input: number; output: number }> = {
    "factory-os": { input: 0.001, output: 0.005 },
    "deepseek/deepseek-v4-pro": { input: 0.0005, output: 0.002 },
    "qwen/qwen3.7-max": { input: 0.0025, output: 0.0075 },
  };
  const c = costs[model] ?? costs["factory-os"];
  const usd =
    (promptTokens * c.input) / 1000 + (completionTokens * c.output) / 1000;
  return usdToEur(usd);
}
