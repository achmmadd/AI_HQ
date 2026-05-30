import { NextRequest, NextResponse } from "next/server";
import { listMyWork } from "@/lib/my-work-service";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const klant = req.nextUrl.searchParams.get("klant")?.trim() || undefined;
  const items = listMyWork(klant);
  return NextResponse.json({ items });
}
