import { NextResponse } from "next/server";
import { fetchLocalExecutorHealth } from "@/lib/local-executor";

export const runtime = "nodejs";

/** Smoke: NUC executor bereikbaar vanaf MotorsAI (server-side). */
export async function GET() {
  const status = await fetchLocalExecutorHealth();
  return NextResponse.json(status, {
    status: status.reachable ? 200 : status.configured ? 503 : 200,
  });
}
