import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { getAgentBySlug } from "@/lib/agent-catalog";

export const runtime = "nodejs";

type UsageRow = {
  id: number;
  klant: string | null;
  afdeling: string | null;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  cost_usd: number | null;
  cost_eur: number | null;
  duration_ms: number | null;
  success: number | null;
  agent_label: string | null;
  input_preview: string | null;
  output_preview: string | null;
  created_at: string | null;
};

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string }> }
) {
  const { slug } = await ctx.params;
  const agent = getAgentBySlug(slug);
  if (!agent) {
    return NextResponse.json({ error: "Onbekende agent" }, { status: 404 });
  }

  const sp = new URL(req.url).searchParams;
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
  const klantRaw = sp.get("klant");
  const klant =
    klantRaw && ["fumero", "bokas"].includes(klantRaw) ? klantRaw : null;

  const rows = db
    .prepare(
      `SELECT id, klant, afdeling, model, prompt_tokens, completion_tokens,
              cost_usd, cost_eur, duration_ms, success, agent_label,
              input_preview, output_preview, created_at
       FROM usage_logs
       WHERE lower(trim(agent_label)) = lower(?)
         AND (? IS NULL OR klant = ?)
       ORDER BY datetime(created_at) DESC
       LIMIT ?`
    )
    .all(agent.label, klant, klant, limit) as UsageRow[];

  return NextResponse.json({
    agent,
    klant_filter: klant,
    runs: rows.map((r) => ({
      id: r.id,
      klant: r.klant,
      afdeling: r.afdeling,
      model: r.model,
      prompt_tokens: r.prompt_tokens,
      completion_tokens: r.completion_tokens,
      cost_usd: r.cost_usd,
      cost_eur: r.cost_eur,
      duration_ms: r.duration_ms,
      success: r.success === 1,
      input_preview: r.input_preview,
      output_preview: r.output_preview,
      created_at: r.created_at,
    })),
  });
}
