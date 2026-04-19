import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const klant = searchParams.get("klant") || "fumero";
  const platform = searchParams.get("platform");
  const status = searchParams.get("status");

  let q = "SELECT * FROM content_posts WHERE klant = ?";
  const params: string[] = [klant];

  if (platform) {
    q += " AND platform = ?";
    params.push(platform);
  }
  if (status) {
    q += " AND status = ?";
    params.push(status);
  }
  q += " ORDER BY datetime(created_at) DESC LIMIT 50";

  const posts = db.prepare(q).all(...params);
  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    klant = "fumero",
    platform,
    type = "post",
    titel,
    content,
    hashtags,
    status = "draft",
    scheduled_at,
    source = "handmatig",
  } = body as Record<string, unknown>;

  if (!platform || typeof platform !== "string" || !content || typeof content !== "string") {
    return NextResponse.json(
      { error: "platform and content required" },
      { status: 400 }
    );
  }

  const result = db
    .prepare(
      `INSERT INTO content_posts
        (klant, platform, type, titel, content, hashtags, status, scheduled_at, source)
       VALUES (?,?,?,?,?,?,?,?,?)`
    )
    .run(
      String(klant),
      platform,
      String(type),
      titel != null ? String(titel) : null,
      content,
      hashtags != null ? String(hashtags) : null,
      String(status),
      scheduled_at != null ? String(scheduled_at) : null,
      String(source)
    );

  return NextResponse.json({ id: result.lastInsertRowid });
}
