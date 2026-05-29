import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { ensureFumeroSchemaAsync } from "@/lib/fumero/db-migrate";
import { requirePhotoStudioKlant } from "@/lib/photo-studio/workspace-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    klant?: string;
    content_id?: number;
    platform?: string;
    datetime?: string;
  };

  const auth = await requirePhotoStudioKlant(req, body.klant);
  if (!auth.ok) return auth.response;

  await ensureFumeroSchemaAsync();

  const contentId = Number(body.content_id);
  const scheduleAt = body.datetime
    ? new Date(body.datetime).toISOString()
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  if (!contentId) {
    return NextResponse.json(
      { error: "content_id is verplicht" },
      { status: 400 }
    );
  }

  const post = db
    .prepare(
      `SELECT id, platform, content, status, media_url
       FROM content_posts WHERE id = ? AND klant = ?`
    )
    .get(contentId, auth.klant) as
    | { id: number; platform: string; content: string; status: string; media_url: string | null }
    | undefined;

  if (!post) {
    return NextResponse.json({ error: "content item niet gevonden" }, { status: 404 });
  }

  const platform = (body.platform || post.platform || "instagram").toLowerCase();
  db.prepare(
    `UPDATE content_posts SET status = 'scheduled', scheduled_at = ?, platform = ? WHERE id = ?`
  ).run(scheduleAt, platform, contentId);

  return NextResponse.json({
    ok: true,
    content_id: contentId,
    platform,
    scheduled_at: scheduleAt,
    queue_status: "scheduled_local",
  });
}
