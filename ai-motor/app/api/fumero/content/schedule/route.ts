import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { ensureFumeroSchemaAsync } from "@/lib/fumero/db-migrate";

export const runtime = "nodejs";

// Bewust GEEN auto-upload naar socials / upload-post / n8n. Plannen is een lokale status.
export async function POST(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  await ensureFumeroSchemaAsync();

  const body = (await req.json().catch(() => ({}))) as {
    content_id?: number;
    platform?: string;
    datetime?: string;
  };
  const contentId = Number(body.content_id);
  const scheduleAt = body.datetime ? new Date(body.datetime).toISOString() : null;
  if (!contentId || !scheduleAt) {
    return NextResponse.json(
      { error: "content_id en datetime zijn verplicht" },
      { status: 400 }
    );
  }

  const post = db
    .prepare(
      `SELECT id, platform, content, status, media_url
       FROM content_posts
       WHERE id = ? AND klant = 'fumero'`
    )
    .get(contentId) as
    | {
        id: number;
        platform: string;
        content: string;
        status: string;
        media_url: string | null;
      }
    | undefined;

  if (!post) {
    return NextResponse.json({ error: "content item niet gevonden" }, { status: 404 });
  }

  const platform = (body.platform || post.platform || "instagram").toLowerCase();
  db.prepare(
    `UPDATE content_posts
     SET status = 'scheduled', scheduled_at = ?, platform = ?
     WHERE id = ?`
  ).run(scheduleAt, platform, contentId);

  // Lokale planning: niets wordt automatisch gepubliceerd of naar socials gepusht.
  return NextResponse.json({
    ok: true,
    content_id: contentId,
    platform,
    scheduled_at: scheduleAt,
    queue_status: "scheduled_local",
    upload_post_configured: false,
  });
}
