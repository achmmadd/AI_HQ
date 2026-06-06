import { NextResponse } from "next/server";
import { fetchBookkeepingHealth } from "@/lib/bookkeeping-bot";

export const runtime = "nodejs";

/** Proxy naar bookkeeping-bot GET /health (pending_approvals, retry_queue, …). */
export async function GET() {
  const health = await fetchBookkeepingHealth();
  return NextResponse.json(health);
}
