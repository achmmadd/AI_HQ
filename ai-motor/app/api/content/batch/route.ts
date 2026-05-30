import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

const ALLOWED = new Set(["draft", "approved", "rejected", "published"]);

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const ids = body?.ids as unknown;
  const status = typeof body?.status === "string" ? body.status : "";
  const klant = typeof body?.klant === "string" ? body.klant : "fumero";

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "ids array required" }, { status: 400 });
  }
  if (!ALLOWED.has(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const numeric = ids
    .map((x) => Number(x))
    .filter((n) => Number.isFinite(n));

  if (numeric.length === 0) {
    return NextResponse.json({ error: "no valid ids" }, { status: 400 });
  }

  const stmt = db.prepare(
    "UPDATE content_posts SET status = ? WHERE id = ? AND klant = ?"
  );
  let updated = 0;
  for (const id of numeric) {
    const r = stmt.run(status, id, klant);
    updated += r.changes;
  }

  return NextResponse.json({ ok: true, updated });
}
