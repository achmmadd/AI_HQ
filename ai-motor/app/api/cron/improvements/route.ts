import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { assertCronSecret } from "@/lib/cron-secret";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

type Item = {
  issue: string;
  reason_cluster?: string;
  count?: number;
  suggested_fix: string;
};

/**
 * n8n — stap D/E: cluster + Dify output opslaan en Telegram sturen.
 * POST body: { items: [{ issue, reason_cluster?, count?, suggested_fix }] }
 */
export async function POST(req: NextRequest) {
  try {
    assertCronSecret(req);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    const status = msg === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }

  const body = await req.json().catch(() => ({}));
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "items[] required" }, { status: 400 });
  }

  const ins = db.prepare(
    `INSERT INTO system_improvements (issue, reason_cluster, count, suggested_fix, status, updated_at)
     VALUES (?, ?, ?, ?, 'new', datetime('now'))`
  );

  const created: number[] = [];

  for (const raw of items as Item[]) {
    const issue = typeof raw.issue === "string" ? raw.issue.trim() : "";
    const suggested_fix =
      typeof raw.suggested_fix === "string" ? raw.suggested_fix.trim() : "";
    if (!issue || !suggested_fix) continue;

    const reason_cluster =
      typeof raw.reason_cluster === "string" ? raw.reason_cluster.trim() : null;
    const count =
      typeof raw.count === "number" && Number.isFinite(raw.count)
        ? Math.max(0, Math.floor(raw.count))
        : 0;

    const r = ins.run(issue, reason_cluster, count, suggested_fix);
    const id = Number(r.lastInsertRowid);
    if (id) created.push(id);

    void sendTelegramMessage(
      `⚠️ Feedback cluster (${count || "?"}×) — ${reason_cluster || issue}\nFix: ${suggested_fix.slice(0, 500)}${suggested_fix.length > 500 ? "…" : ""}`
    );
  }

  return NextResponse.json({ ok: true, ids: created });
}
