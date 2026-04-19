import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

type PostRow = {
  id: number;
  status: string;
  content: string;
  hashtags: string | null;
  scheduled_at: string | null;
  published_at: string | null;
};

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const row = db
    .prepare("SELECT * FROM content_posts WHERE id = ?")
    .get(id) as PostRow | undefined;
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const body = await req.json();
  const { status, content, hashtags, scheduled_at, published_at } = body as Record<
    string,
    unknown
  >;

  const nextStatus = typeof status === "string" ? status : row.status;
  const nextContent = typeof content === "string" ? content : row.content;
  let nextHashtags = row.hashtags;
  if (hashtags !== undefined) {
    nextHashtags = hashtags == null ? null : String(hashtags);
  }
  let nextScheduled = row.scheduled_at;
  if (scheduled_at !== undefined) {
    nextScheduled = scheduled_at == null ? null : String(scheduled_at);
  }
  let nextPublished = row.published_at;
  if (published_at !== undefined) {
    nextPublished = published_at == null ? null : String(published_at);
  }
  if (nextStatus === "published" && !nextPublished) {
    nextPublished = new Date().toISOString();
  }

  db.prepare(
    `UPDATE content_posts SET
      status = ?, content = ?, hashtags = ?, scheduled_at = ?, published_at = ?
    WHERE id = ?`
  ).run(nextStatus, nextContent, nextHashtags, nextScheduled, nextPublished, id);

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  db.prepare("DELETE FROM content_posts WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
