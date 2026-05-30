import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { ensureFumeroSchemaAsync } from "@/lib/fumero/db-migrate";

export const runtime = "nodejs";

function parseSeoFromEnv(): Array<{
  keyword: string;
  volume: number;
  position: number;
  trend: string;
}> {
  const raw = process.env.FUMERO_SEO_KEYWORDS_JSON?.trim();
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as unknown[];
    if (!Array.isArray(arr)) return [];
    return arr
      .map((row) => {
        const o = row as Record<string, unknown>;
        return {
          keyword: String(o.keyword ?? ""),
          volume: Number(o.volume) || 0,
          position: Number(o.position) || 0,
          trend: String(o.trend ?? "flat"),
        };
      })
      .filter((r) => r.keyword);
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  await ensureFumeroSchemaAsync();

  const postStats = db
    .prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as drafts,
         SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
         SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
         SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled
       FROM content_posts
       WHERE klant = 'fumero'`
    )
    .get() as {
    total: number;
    drafts: number;
    approved: number;
    published: number;
    scheduled: number;
  };

  const byPlatform = db
    .prepare(
      `SELECT platform, COUNT(*) as total,
         SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published
       FROM content_posts WHERE klant = 'fumero'
       GROUP BY platform ORDER BY total DESC`
    )
    .all() as Array<{ platform: string; total: number; published: number }>;

  const recentDays = db
    .prepare(
      `SELECT date(created_at) as day, COUNT(*) as total
       FROM content_posts WHERE klant = 'fumero'
       GROUP BY date(created_at) ORDER BY day DESC LIMIT 14`
    )
    .all() as Array<{ day: string; total: number }>;

  const latestPosts = db
    .prepare(
      `SELECT id, platform, status, content, created_at, scheduled_at
       FROM content_posts WHERE klant = 'fumero'
       ORDER BY datetime(created_at) DESC LIMIT 12`
    )
    .all();

  const scheduledCalendar = db
    .prepare(
      `SELECT id, platform, status, content, scheduled_at, media_url, type, titel
       FROM content_posts
       WHERE klant = 'fumero' AND status = 'scheduled'
       ORDER BY datetime(COALESCE(scheduled_at, created_at)) ASC
       LIMIT 40`
    )
    .all();

  const experiments = db
    .prepare(
      `SELECT id, name, status, winner_variant, klant
       FROM experiments WHERE klant = 'fumero' AND status = 'active'
       ORDER BY id DESC LIMIT 5`
    )
    .all();

  const seo_keywords = parseSeoFromEnv();
  const upload_post_configured = Boolean(
    process.env.N8N_UPLOAD_POST_WEBHOOK?.trim() ||
      process.env.N8N_SOCIAL_SCHEDULER_WEBHOOK?.trim()
  );

  return NextResponse.json({
    posts: {
      total: Number(postStats.total || 0),
      drafts: Number(postStats.drafts || 0),
      approved: Number(postStats.approved || 0),
      published: Number(postStats.published || 0),
      scheduled: Number(postStats.scheduled || 0),
    },
    by_platform: byPlatform.map((row) => ({
      platform: row.platform || "unknown",
      total: Number(row.total || 0),
      published: Number(row.published || 0),
    })),
    recent_days: recentDays
      .map((row) => ({ day: row.day, total: Number(row.total || 0) }))
      .reverse(),
    latest_posts: latestPosts,
    scheduled_calendar: scheduledCalendar,
    seo_keywords,
    seo_configured: seo_keywords.length > 0,
    influencers: [],
    influencers_note:
      "Configureer influencer-CRM of koppel een externe API — geen demo-data in productie.",
    clarity: null,
    clarity_note: "Koppel Microsoft Clarity API (FUMERO_CLARITY_*) voor live heatmaps.",
    ab_tests: experiments,
    upload_post_configured,
  });
}
