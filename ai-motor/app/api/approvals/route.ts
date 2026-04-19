import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

function baseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:3040"
  );
}

export async function GET() {
  const approvals = db
    .prepare(
      "SELECT * FROM approvals WHERE status = 'pending' ORDER BY datetime(created_at) DESC"
    )
    .all();

  return NextResponse.json({ approvals });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    title,
    description,
    action,
    payload,
    requested_by = "factory-os",
  } = body as Record<string, unknown>;

  if (!title || !action) {
    return NextResponse.json(
      { error: "title and action required" },
      { status: 400 }
    );
  }

  const result = db
    .prepare(
      `INSERT INTO approvals
        (title, description, action, payload, requested_by)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      String(title),
      description != null ? String(description) : null,
      String(action),
      payload != null ? JSON.stringify(payload) : null,
      String(requested_by)
    );

  const id = result.lastInsertRowid as number;
  const appUrl = baseUrl();

  void sendTelegramMessage(
    `Goedkeuring nodig #${id}\n\n${String(title)}\n${description != null ? String(description) : ""}\n\nActie: ${String(action)}\n\nOpen: ${appUrl}/approvals?approve=${id}\nOf afwijzen: ${appUrl}/approvals?reject=${id}`
  );

  return NextResponse.json({
    id,
    message: "Goedkeuring aangevraagd — check Telegram",
  });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, status } = body as { id?: number; status?: string };

  if (id == null || !status) {
    return NextResponse.json(
      { error: "id and status required" },
      { status: 400 }
    );
  }

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json(
      { error: "status must be approved or rejected" },
      { status: 400 }
    );
  }

  db.prepare(
    `UPDATE approvals SET status = ?, resolved_at = datetime('now') WHERE id = ?`
  ).run(status, id);

  const emoji = status === "approved" ? "✅" : "❌";
  void sendTelegramMessage(`${emoji} Goedkeuring #${id}: ${status}`);

  return NextResponse.json({ message: status });
}
