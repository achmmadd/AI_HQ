import { NextResponse } from "next/server";
import { proxyBookkeepingJson } from "@/lib/bookkeeping-bot";

export const runtime = "nodejs";

/** Proxy naar bookkeeping-bot GET /recent (receipts). */
export async function GET() {
  const { data } = await proxyBookkeepingJson("/recent", undefined, {
    receipts: [],
  });
  return NextResponse.json(data);
}
