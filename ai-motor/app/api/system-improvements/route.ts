import { NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

export async function GET() {
  const rows = db
    .prepare(
      `SELECT id, issue, reason_cluster, count, suggested_fix, status, created_at, updated_at
       FROM system_improvements
       ORDER BY datetime(created_at) DESC
       LIMIT 200`
    )
    .all();

  return NextResponse.json({ improvements: rows });
}
