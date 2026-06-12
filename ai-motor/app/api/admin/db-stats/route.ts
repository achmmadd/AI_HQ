import { existsSync, readdirSync, statSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { requireAdminApi } from "@/lib/require-admin";

export const runtime = "nodejs";

const HOME = process.env.HOME || "/home/pietje";
const DB_PATH = path.join(HOME, "AI_HQ", "data", "ai-motor.db");
const BACKUP_DIR = path.join(HOME, "backups", "motor-ai");

const TABLES = [
  "conversations",
  "chat_history",
  "todos",
  "approvals",
  "experiments",
  "usage_logs",
  "automation_runs",
  "custom_apps",
  "knowledge_documents",
];

function tableCount(table: string): number {
  try {
    const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as
      | { count: number }
      | undefined;
    return Number(row?.count) || 0;
  } catch {
    return 0;
  }
}

function latestBackup(): { path: string; created_at: string; size_mb: number } | null {
  try {
    if (!existsSync(BACKUP_DIR)) return null;
    const files = readdirSync(BACKUP_DIR)
      .filter((name) => name.endsWith(".db"))
      .map((name) => {
        const full = path.join(BACKUP_DIR, name);
        const st = statSync(full);
        return {
          path: full,
          created_at: st.mtime.toISOString(),
          size_mb: Math.round((st.size / 1024 / 1024) * 100) / 100,
        };
      })
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    return files[0] || null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;

  const dbStat = existsSync(DB_PATH) ? statSync(DB_PATH) : null;
  return NextResponse.json({
    db_path: DB_PATH,
    db_size_mb: dbStat ? Math.round((dbStat.size / 1024 / 1024) * 100) / 100 : 0,
    tables: Object.fromEntries(TABLES.map((table) => [table, tableCount(table)])),
    latest_backup: latestBackup(),
  });
}
