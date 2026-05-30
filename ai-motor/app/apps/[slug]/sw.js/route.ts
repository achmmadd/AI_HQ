import { NextRequest, NextResponse } from "next/server";
import { getPublishedApp } from "@/lib/apps/apps-db";
import { buildServiceWorkerScript } from "@/lib/apps/pwa";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const app = getPublishedApp(slug);
  if (!app) {
    return new NextResponse(`/* SW not available: app not published */`, {
      status: 404,
      headers: { "Content-Type": "application/javascript; charset=utf-8" },
    });
  }
  const script = buildServiceWorkerScript(app);
  return new NextResponse(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Service-Worker-Allowed": `/apps/${app.slug}/`,
    },
  });
}
