import { NextRequest, NextResponse } from "next/server";
import { fetchN8nWorkflowSummaries, getN8nApiKey } from "@/lib/n8n-workflows-api";
import { requireAdminApi } from "@/lib/require-admin";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;

  if (!getN8nApiKey()) {
    return NextResponse.json(
      {
        error: "N8N_API_KEY ontbreekt in serveromgeving.",
        workflows: [],
        configured: false,
      },
      { status: 503 }
    );
  }
  try {
    const { workflows, baseUrl } = await fetchN8nWorkflowSummaries();
    return NextResponse.json({
      workflows,
      n8nHost: baseUrl,
      configured: true,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "n8n ophalen mislukt";
    return NextResponse.json({ error: msg, workflows: [] }, { status: 502 });
  }
}
