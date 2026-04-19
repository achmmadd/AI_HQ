import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

type ShiftRow = {
  id: number;
  personeels_id: number;
  datum: string;
  start_tijd: string;
  eind_tijd: string;
  rol: string | null;
  status: string;
};

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
  const { datum, start_tijd, eind_tijd, rol, status } = body as Record<
    string,
    unknown
  >;

  const row = db
    .prepare("SELECT * FROM bokas_shifts WHERE id = ?")
    .get(id) as ShiftRow | undefined;
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const nextDatum = typeof datum === "string" ? datum : row.datum;
  const nextStart = typeof start_tijd === "string" ? start_tijd : row.start_tijd;
  const nextEnd = typeof eind_tijd === "string" ? eind_tijd : row.eind_tijd;
  const nextStatus = typeof status === "string" ? status : row.status;
  let nextRol = row.rol;
  if (rol !== undefined) {
    nextRol = rol == null ? null : String(rol);
  }

  db.prepare(
    `UPDATE bokas_shifts SET
      datum = ?, start_tijd = ?, eind_tijd = ?, rol = ?, status = ?
    WHERE id = ?`
  ).run(nextDatum, nextStart, nextEnd, nextRol, nextStatus, id);

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
  db.prepare("DELETE FROM bokas_shifts WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
