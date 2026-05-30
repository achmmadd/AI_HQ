import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { activateFumeroEmailFlow } from "@/lib/fumero/email-flow";
import { ensureFumeroSchemaAsync } from "@/lib/fumero/db-migrate";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  await ensureFumeroSchemaAsync();

  const body = (await req.json().catch(() => ({}))) as { flow_id?: number };
  const flowId = Number(body.flow_id);
  if (!flowId) {
    return NextResponse.json({ error: "flow_id is verplicht" }, { status: 400 });
  }

  try {
    const result = await activateFumeroEmailFlow(flowId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Activeren mislukt" },
      { status: 502 }
    );
  }
}
