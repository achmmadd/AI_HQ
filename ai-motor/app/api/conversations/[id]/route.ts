import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { assertScopeAccess } from "@/lib/auth-session";
import { requireApiAuthSession } from "@/lib/require-api-auth";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuthSession(req);
  if (auth instanceof NextResponse) return auth;

  const { id: idStr } = await context.params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const row = db
    .prepare(`SELECT id, klant FROM conversations WHERE id = ?`)
    .get(id) as { id: number; klant: string } | undefined;
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const scopeErr = assertScopeAccess(auth.session, row.klant);
  if (scopeErr) return scopeErr;

  const klant =
    new URL(req.url).searchParams.get("klant")?.trim() || null;
  if (klant && row.klant !== klant) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const title =
    typeof (body as { title?: string }).title === "string"
      ? (body as { title: string }).title.trim()
      : "";
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  db.prepare(
    `UPDATE conversations SET title = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(title.slice(0, 200), id);

  const conv = db
    .prepare(`SELECT id, klant, title, created_at, updated_at FROM conversations WHERE id = ?`)
    .get(id);
  return NextResponse.json(conv);
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAuthSession(req);
  if (auth instanceof NextResponse) return auth;

  const { id: idStr } = await context.params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const row = db
    .prepare(`SELECT id, klant FROM conversations WHERE id = ?`)
    .get(id) as { id: number; klant: string } | undefined;
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const scopeErr = assertScopeAccess(auth.session, row.klant);
  if (scopeErr) return scopeErr;

  const klant =
    new URL(req.url).searchParams.get("klant")?.trim() || null;
  if (klant && row.klant !== klant) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  db.prepare(`DELETE FROM chat_history WHERE conversation_id = ?`).run(id);
  db.prepare(`DELETE FROM conversations WHERE id = ?`).run(id);

  return NextResponse.json({ ok: true });
}
