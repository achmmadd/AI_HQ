import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { ensurePlatformSchema } from "@/lib/db/platform-schema";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  ensurePlatformSchema();
  const sp = new URL(req.url).searchParams;
  const limit = Math.min(
    500,
    Math.max(1, parseInt(sp.get("limit") ?? "100", 10) || 100)
  );
  const klant = sp.get("klant")?.trim();
  const action = sp.get("action")?.trim();

  let sql = `SELECT id, actor, action, resource, detail_json, klant, created_at
             FROM audit_logs WHERE 1=1`;
  const params: (string | number)[] = [];

  if (klant) {
    sql += ` AND klant = ?`;
    params.push(klant);
  }
  if (action) {
    sql += ` AND action LIKE ?`;
    params.push(`%${action.slice(0, 64)}%`);
  }

  sql += ` ORDER BY id DESC LIMIT ?`;
  params.push(limit);

  const logs = db.prepare(sql).all(...params) as Array<{
    id: number;
    actor: string;
    action: string;
    resource: string | null;
    detail_json: string | null;
    klant: string | null;
    created_at: string;
  }>;

  return NextResponse.json({
    logs: logs.map((row) => ({
      ...row,
      detail: row.detail_json
        ? (() => {
            try {
              return JSON.parse(row.detail_json) as Record<string, unknown>;
            } catch {
              return { raw: row.detail_json };
            }
          })()
        : null,
    })),
  });
}
