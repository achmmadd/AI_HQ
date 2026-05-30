import { NextRequest, NextResponse } from "next/server";
import { fetchN8nExecutions } from "@/lib/n8n-executions-api";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const limitRaw = new URL(req.url).searchParams.get("limit");
  const limit = Math.min(
    100,
    Math.max(1, parseInt(limitRaw ?? "30", 10) || 30)
  );

  const result = await fetchN8nExecutions(limit);
  return NextResponse.json(result);
}
