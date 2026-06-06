import { NextRequest, NextResponse } from "next/server";
import { normalizeVanillaAppHtml } from "@/lib/builder-code";
import {
  getConceptVersion,
  getPublishedVersion,
  getToolById,
  getVersion,
} from "@/lib/fumero/tools-db";

export const runtime = "nodejs";

/**
 * Kale HTML-preview van een toolversie — geen nested iframe.
 * Gebruikt door de bouwen-preview en "Speel / Open app".
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const toolId = parseInt(String(sp.get("tool") ?? ""), 10);
  if (Number.isNaN(toolId)) {
    return htmlError("Ongeldige tool-id", 400);
  }

  const tool = getToolById(toolId);
  if (!tool) return htmlError("Tool niet gevonden", 404);

  let versionId = parseInt(String(sp.get("version") ?? ""), 10);
  if (Number.isNaN(versionId)) {
    const concept = getConceptVersion(toolId);
    const published = getPublishedVersion(toolId);
    versionId = concept?.id ?? published?.id ?? NaN;
  }
  if (Number.isNaN(versionId)) {
    return htmlError("Geen previewversie beschikbaar", 404);
  }

  const version = getVersion(versionId);
  if (!version || version.tool_id !== tool.id) {
    return htmlError("Versie niet gevonden", 404);
  }

  const html = normalizeVanillaAppHtml(version.code);
  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function htmlError(message: string, status: number): NextResponse {
  return new NextResponse(
    `<!DOCTYPE html><html lang="nl"><body style="font-family:system-ui;padding:24px;color:#525252">${message}</body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
