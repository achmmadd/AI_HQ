import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

type TodoRow = {
  id: number;
  status: string;
  priority: string;
  title: string;
  description: string | null;
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

  const existing = db
    .prepare("SELECT * FROM todos WHERE id = ?")
    .get(id) as TodoRow | undefined;
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json();
  const status =
    typeof body.status === "string" ? body.status : existing.status;
  const priority =
    typeof body.priority === "string" ? body.priority : existing.priority;
  const title = typeof body.title === "string" ? body.title : existing.title;
  const description =
    typeof body.description === "string"
      ? body.description
      : existing.description;

  db.prepare(
    `UPDATE todos SET
      status = ?,
      priority = ?,
      title = ?,
      description = ?,
      updated_at = datetime('now')
    WHERE id = ?`
  ).run(status, priority, title, description, id);

  return NextResponse.json({ message: "Updated" });
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
  db.prepare("DELETE FROM todos WHERE id = ?").run(id);
  return NextResponse.json({ message: "Deleted" });
}
