import { NextRequest, NextResponse } from "next/server";
import { searchMotorMemories } from "@/lib/motor-memory";
import { isMotorsInternalAuthorized } from "@/lib/motors-internal-auth";

export const runtime = "nodejs";

function authorized(req: NextRequest): boolean {
  const expected = process.env.MOTORS_INTERNAL_TOKEN?.trim();
  if (!expected) return true;
  return isMotorsInternalAuthorized(req);
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const query = typeof body?.query === "string" ? body.query.trim() : "";
  const klant =
    typeof body?.klant === "string" && body.klant ? body.klant : "system";
  const limit =
    typeof body?.limit === "number" && body.limit > 0
      ? Math.min(body.limit, 10)
      : 5;

  if (!query) {
    return NextResponse.json({ error: "query required" }, { status: 400 });
  }

  const res = await searchMotorMemories(query, klant, limit);
  return NextResponse.json({
    results: res.results.map((h) => ({
      text: h.payload?.text ?? "",
      client: h.payload?.client,
      score: h.score,
    })),
  });
}
