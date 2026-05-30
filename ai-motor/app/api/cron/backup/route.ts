import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { verifyCronSecret } from "@/lib/cron-secret";
import { logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!verifyCronSecret(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const home = process.env.HOME || "/home/pietje";
  const src = path.join(home, "AI_HQ", "data", "ai-motor.db");
  const destDir = path.join(home, "backups", "motor-ai");
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = path.join(destDir, `ai-motor-${stamp}.db`);
  fs.copyFileSync(src, dest);

  logAudit({ action: "backup_cron", resource: dest });

  return NextResponse.json({ ok: true, path: dest });
}
