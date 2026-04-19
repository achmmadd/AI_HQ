import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

type Row = {
  id: number;
  status: string;
  suggested_reply: string | null;
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const row = db
    .prepare("SELECT * FROM fumero_reviews WHERE id = ?")
    .get(id) as Row | undefined;
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ review: row });
}

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
  const { status, suggested_reply } = body as {
    status?: string;
    suggested_reply?: string;
  };

  if (!status && suggested_reply === undefined) {
    return NextResponse.json(
      { error: "status or suggested_reply required" },
      { status: 400 }
    );
  }

  const existing = db
    .prepare("SELECT * FROM fumero_reviews WHERE id = ?")
    .get(id) as Row | undefined;
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const nextStatus = status ?? existing.status;
  const nextReply =
    suggested_reply !== undefined
      ? suggested_reply
      : existing.suggested_reply;

  db.prepare(
    `UPDATE fumero_reviews
     SET status = ?, suggested_reply = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(nextStatus, nextReply, id);

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
  db.prepare("DELETE FROM fumero_reviews WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
