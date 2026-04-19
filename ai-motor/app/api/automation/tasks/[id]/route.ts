import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: idRaw } = await ctx.params;
  const id = parseInt(idRaw, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const row = db
    .prepare("SELECT id FROM automation_tasks WHERE id = ?")
    .get(id) as { id: number } | undefined;
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    enabled,
    approval_required,
    schedule_time,
    schedule_kind,
    schedule_weekday,
    title,
    description,
  } = body as {
    enabled?: boolean;
    approval_required?: boolean;
    schedule_time?: string;
    schedule_kind?: string;
    schedule_weekday?: number | null;
    title?: string;
    description?: string;
  };

  const updates: string[] = ["updated_at = datetime('now')"];
  const values: (string | number | null)[] = [];

  if (typeof enabled === "boolean") {
    updates.push("enabled = ?");
    values.push(enabled ? 1 : 0);
  }
  if (typeof approval_required === "boolean") {
    updates.push("approval_required = ?");
    values.push(approval_required ? 1 : 0);
  }
  if (typeof schedule_time === "string" && /^\d{1,2}:\d{2}$/.test(schedule_time)) {
    updates.push("schedule_time = ?");
    values.push(schedule_time);
  }
  if (schedule_kind === "daily" || schedule_kind === "weekly") {
    updates.push("schedule_kind = ?");
    values.push(schedule_kind);
  }
  if (schedule_weekday === null || (typeof schedule_weekday === "number" && schedule_weekday >= 0 && schedule_weekday <= 6)) {
    updates.push("schedule_weekday = ?");
    values.push(schedule_weekday ?? null);
  }
  if (typeof title === "string" && title.trim()) {
    updates.push("title = ?");
    values.push(title.trim());
  }
  if (typeof description === "string") {
    updates.push("description = ?");
    values.push(description);
  }

  if (updates.length <= 1) {
    return NextResponse.json({ error: "no valid fields" }, { status: 400 });
  }

  values.push(id);
  db.prepare(
    `UPDATE automation_tasks SET ${updates.join(", ")} WHERE id = ?`
  ).run(...values);

  const task = db.prepare("SELECT * FROM automation_tasks WHERE id = ?").get(id);
  return NextResponse.json({ task });
}
