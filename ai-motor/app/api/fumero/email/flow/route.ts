import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { buildFumeroEmailFlow } from "@/lib/fumero/email-flow";
import { ensureFumeroSchemaAsync } from "@/lib/fumero/db-migrate";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  await ensureFumeroSchemaAsync();

  const body = (await req.json().catch(() => ({}))) as { prompt?: string };
  const prompt = String(body.prompt || "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt is verplicht" }, { status: 400 });
  }

  try {
    const { draft, flow_id, n8n_status } = await buildFumeroEmailFlow(prompt);
    return NextResponse.json({
      ok: true,
      prompt,
      draft,
      flow_id,
      n8n_status,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Flow bouwen mislukt" },
      { status: 502 }
    );
  }
}
