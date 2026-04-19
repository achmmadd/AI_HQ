import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { appendLearnedInstructionChunk } from "@/lib/chat-learned";
import { callFactoryN8n } from "@/lib/chat-n8n";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await context.params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const statusRaw = (body as { status?: string }).status?.trim();

  if (
    statusRaw !== "reviewed" &&
    statusRaw !== "applied" &&
    statusRaw !== "rejected"
  ) {
    return NextResponse.json(
      { error: "status must be reviewed | applied | rejected" },
      { status: 400 }
    );
  }

  const row = db
    .prepare(
      `SELECT id, suggested_fix, status FROM system_improvements WHERE id = ?`
    )
    .get(id) as
    | { id: number; suggested_fix: string; status: string }
    | undefined;

  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (statusRaw === "applied") {
    if (row.status === "applied") {
      return NextResponse.json({ error: "Al toegepast" }, { status: 409 });
    }
    appendLearnedInstructionChunk(row.suggested_fix);
    db.prepare(
      `UPDATE system_improvements
       SET status = 'applied', updated_at = datetime('now') WHERE id = ?`
    ).run(id);

    void callFactoryN8n({
      prompt: `Goedgekeurde chat-verbetering toegepast in prompt-suffix (Factory OS). Samenvatting voor logging:\n${row.suggested_fix.slice(0, 1500)}`,
      klant: "system",
      afdeling: "fabriek",
      type: "improvement_applied",
      improvement_id: id,
    });

    return NextResponse.json({ ok: true, applied: true });
  }

  db.prepare(
    `UPDATE system_improvements SET status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(statusRaw, id);

  return NextResponse.json({ ok: true, status: statusRaw });
}
