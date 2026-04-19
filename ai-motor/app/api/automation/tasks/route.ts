import { NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

export async function GET() {
  const tasks = db
    .prepare(
      `SELECT id, task_key, title, description, schedule_kind, schedule_time,
              schedule_weekday, enabled, approval_required, integration,
              config_json, created_at, updated_at
       FROM automation_tasks
       ORDER BY id ASC`
    )
    .all();
  return NextResponse.json({ tasks });
}
