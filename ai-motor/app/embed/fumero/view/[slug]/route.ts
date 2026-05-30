import { NextRequest, NextResponse } from "next/server";
import { getPublishedBySlug } from "@/lib/fumero/tools-service";
import { normalizeVanillaAppHtml } from "@/lib/builder-code";

export const runtime = "nodejs";

/**
 * Publieke, chrome-loze render van de live (published) tool — als kale HTML.
 * Wordt gebruikt door de widget-iframe en als deelbare klant-URL. Valt onder
 * /embed/* en is daarmee publiek toegankelijk (zie middleware allowlist).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const safe = slug.replace(/[^a-z0-9-]/gi, "");
  const published = getPublishedBySlug(safe);

  if (!published || published.tool.deploy_type === "internal") {
    return new NextResponse(
      "<!DOCTYPE html><html lang=\"nl\"><body style=\"font-family:system-ui;padding:24px;color:#525252\">Tool niet gevonden of niet gepubliceerd.</body></html>",
      { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  const html = normalizeVanillaAppHtml(published.version.code);
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=120",
    },
  });
}
