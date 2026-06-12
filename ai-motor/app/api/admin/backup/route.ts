import { existsSync, mkdirSync, statSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { requireAdminApi } from "@/lib/require-admin";

export const runtime = "nodejs";

const BACKUP_DIR = path.join(
  process.env.HOME || "/home/pietje",
  "backups",
  "motor-ai"
);

function backupStamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "")
    .replace("T", "_");
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (!auth.ok) return auth.response;

  try {
    mkdirSync(BACKUP_DIR, { recursive: true });
    const backupPath = path.join(BACKUP_DIR, `motor-ai-${backupStamp()}.db`);
    await db.backup(backupPath);

    const st = existsSync(backupPath) ? statSync(backupPath) : null;
    return NextResponse.json({
      success: true,
      path: backupPath,
      size_mb: st ? Math.round((st.size / 1024 / 1024) * 100) / 100 : 0,
    });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "backup failed",
      },
      { status: 500 }
    );
  }
}
