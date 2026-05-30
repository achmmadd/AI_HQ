import db from "@/lib/db/database";
import { ensurePlatformSchema } from "@/lib/db/platform-schema";

ensurePlatformSchema();
import { usdToEur } from "@/lib/eur-cost";

let usageSchemaReady = false;

function ensureUsageLogsSchema(): void {
  if (usageSchemaReady) return;
  const cols = db
    .prepare(`SELECT name FROM pragma_table_info('usage_logs')`)
    .all() as { name: string }[];
  const has = (n: string) => cols.some((c) => c.name === n);
  const add = (sql: string) => {
    try {
      db.exec(sql);
    } catch {
      /* kolom bestaat al */
    }
  };
  if (!has("agent_label")) add(`ALTER TABLE usage_logs ADD COLUMN agent_label TEXT`);
  if (!has("cost_eur")) add(`ALTER TABLE usage_logs ADD COLUMN cost_eur REAL DEFAULT 0`);
  if (!has("input_preview")) {
    add(`ALTER TABLE usage_logs ADD COLUMN input_preview TEXT`);
  }
  if (!has("output_preview")) {
    add(`ALTER TABLE usage_logs ADD COLUMN output_preview TEXT`);
  }
  usageSchemaReady = true;
}

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 0.003, output: 0.015 },
  "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
  "claude-haiku-4-5-20251001": { input: 0.001, output: 0.005 },
  "claude-haiku-4-5": { input: 0.001, output: 0.005 },
  "deepseek-chat": { input: 0.00027, output: 0.0011 },
  "deepseek/deepseek-v4-flash": { input: 0.00006, output: 0.00022 },
  "deepseek/deepseek-v4-pro": { input: 0.0005, output: 0.002 },
  "qwen/qwen3.7-max": { input: 0.0025, output: 0.0075 },
  "openrouter:qwen/qwen3.7-max": { input: 0.0025, output: 0.0075 },
  "openrouter/pareto-code": { input: 0.0005, output: 0.002 },
  "openrouter:openrouter/pareto-code": { input: 0.0005, output: 0.002 },
  "perplexity/sonar-pro": { input: 0.003, output: 0.015 },
  "moonshotai/kimi-k2.6": { input: 0.0016, output: 0.004 },
  "openrouter-direct": { input: 0.0005, output: 0.002 },
  "openclaw-gateway": { input: 0.001, output: 0.005 },
  ollama: { input: 0, output: 0 },
  "factory-os": { input: 0.001, output: 0.005 },
};

function clipPreview(s: string | null | undefined, max: number): string | null {
  if (s == null || !String(s).trim()) return null;
  const t = String(s).trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function costUsd(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const costs = MODEL_COSTS[model] ?? MODEL_COSTS["factory-os"];
  return (
    (promptTokens * costs.input) / 1000 +
    (completionTokens * costs.output) / 1000
  );
}

export function logAgentUsage(opts: {
  agentLabel: string;
  klant?: string | null;
  afdeling?: string | null;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  durationMs: number;
  success?: boolean;
  inputPreview?: string | null;
  outputPreview?: string | null;
}): void {
  ensureUsageLogsSchema();
  const pt = Number(opts.promptTokens) || 0;
  const ct = Number(opts.completionTokens) || 0;
  const m = String(opts.model);
  const cost_usd = costUsd(m, pt, ct);
  const cost_eur = usdToEur(cost_usd);
  db.prepare(
    `INSERT INTO usage_logs
      (klant, afdeling, model, prompt_tokens, completion_tokens,
       cost_usd, cost_eur, duration_ms, success, agent_label,
       input_preview, output_preview)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    opts.klant ?? null,
    opts.afdeling ?? null,
    m,
    pt,
    ct,
    cost_usd,
    cost_eur,
    Math.max(0, Number(opts.durationMs) || 0),
    opts.success === false ? 0 : 1,
    opts.agentLabel.slice(0, 128),
    clipPreview(opts.inputPreview, 4000),
    clipPreview(opts.outputPreview, 8000)
  );
}
