import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const body = await req.json();
  const status =
    typeof body.status === "string" ? body.status : undefined;
  if (!status) {
    return NextResponse.json({ error: "status required" }, { status: 400 });
  }
  db.prepare("UPDATE bokas_reserveringen SET status = ? WHERE id = ?").run(
    status,
    id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  db.prepare("DELETE FROM bokas_reserveringen WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
