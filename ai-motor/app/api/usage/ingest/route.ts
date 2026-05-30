import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { ensurePlatformSchema } from "@/lib/db/platform-schema";
import { usdToEur } from "@/lib/eur-cost";

export const runtime = "nodejs";

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "factory-os": { input: 0.001, output: 0.005 },
  "deepseek/deepseek-v4-pro": { input: 0.0005, output: 0.002 },
};

function authorized(req: NextRequest): boolean {
  const secret = process.env.USAGE_INGEST_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("x-usage-ingest-secret") === secret;
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  ensurePlatformSchema();
  const body = await req.json();
  const {
    klant,
    afdeling,
    model = "factory-os",
    prompt_tokens = 0,
    completion_tokens = 0,
    duration_ms = 0,
    success = true,
    agent_label,
    input_preview,
    output_preview,
    cost_eur: costEurBody,
  } = body as Record<string, unknown>;

  const m = String(model);
  const costs = MODEL_COSTS[m] ?? MODEL_COSTS["factory-os"];
  const pt = Number(prompt_tokens) || 0;
  const ct = Number(completion_tokens) || 0;
  const cost_usd =
    (pt * costs.input) / 1000 + (ct * costs.output) / 1000;
  const cost_eur =
    costEurBody != null ? Number(costEurBody) : usdToEur(cost_usd);

  db.prepare(
    `INSERT INTO usage_logs
      (klant, afdeling, model, prompt_tokens, completion_tokens,
       cost_usd, cost_eur, duration_ms, success, agent_label,
       input_preview, output_preview)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    klant != null ? String(klant) : null,
    afdeling != null ? String(afdeling) : null,
    m,
    pt,
    ct,
    cost_usd,
    cost_eur,
    Number(duration_ms) || 0,
    success ? 1 : 0,
    agent_label != null ? String(agent_label).slice(0, 128) : null,
    input_preview != null ? String(input_preview).slice(0, 4000) : null,
    output_preview != null ? String(output_preview).slice(0, 8000) : null
  );

  return NextResponse.json({ logged: true, cost_usd, cost_eur });
}
