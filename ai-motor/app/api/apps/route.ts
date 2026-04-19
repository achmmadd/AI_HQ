import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { sendTelegramMessage } from "@/lib/telegram";

export const runtime = "nodejs";

function cleanSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET() {
  const apps = db
    .prepare(
      `SELECT id, naam, slug, beschrijving, status, klant, created_at
       FROM custom_apps ORDER BY created_at DESC`
    )
    .all();
  return NextResponse.json({ apps });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const naam = typeof body?.naam === "string" ? body.naam.trim() : "";
  const slugRaw = typeof body?.slug === "string" ? body.slug.trim() : "";
  const code = typeof body?.code === "string" ? body.code : "";
  const beschrijving =
    typeof body?.beschrijving === "string" ? body.beschrijving : null;
  const klant =
    typeof body?.klant === "string" && body.klant ? body.klant : "system";

  if (!naam || !slugRaw || !code.trim()) {
    return NextResponse.json(
      { error: "naam, slug, code required" },
      { status: 400 }
    );
  }

  const slug = cleanSlug(slugRaw);
  if (!slug) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  try {
    const result = db
      .prepare(
        `INSERT INTO custom_apps (naam, slug, beschrijving, code, klant)
         VALUES (?,?,?,?,?)`
      )
      .run(naam, slug, beschrijving, code, klant);

    const base =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      "https://motorsai.app";
    void sendTelegramMessage(
      `Nieuwe custom app: ${naam}\nLive: ${base}/apps/${slug}`
    );

    return NextResponse.json({
      id: Number(result.lastInsertRowid),
      slug,
      url: `/apps/${slug}`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("UNIQUE")) {
      return NextResponse.json({ error: "slug already exists" }, { status: 409 });
    }
    throw e;
  }
}
