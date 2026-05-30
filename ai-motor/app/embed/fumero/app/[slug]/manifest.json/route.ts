import { NextRequest, NextResponse } from "next/server";
import { getPublishedApp } from "@/lib/apps/apps-db";
import { buildWebAppManifest } from "@/lib/apps/pwa";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const app = getPublishedApp(slug);
  if (!app || app.type !== "customer") {
    return NextResponse.json({ error: "not found, not published or not customer app" }, { status: 404 });
  }
  const manifest = buildWebAppManifest(app);
  return new NextResponse(JSON.stringify(manifest, null, 2), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
