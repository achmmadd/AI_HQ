import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const app = db
    .prepare("SELECT * FROM custom_apps WHERE slug = ?")
    .get(slug) as Record<string, unknown> | undefined;
  if (!app) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ app });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  db.prepare("DELETE FROM custom_apps WHERE slug = ?").run(slug);
  return NextResponse.json({ ok: true });
}
