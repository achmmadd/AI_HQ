import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { ensureAppsSchema } from "@/lib/apps/apps-db";
import { generateFullApp, refineFullApp } from "@/lib/apps/apps-service";
import { formatFumeroBuilderError } from "@/lib/fumero/builder-config";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "all");
  if (!auth.ok) return auth.response;

  ensureAppsSchema();

  const body = (await req.json().catch(() => ({}))) as { prompt?: string; klant?: string; slug?: string; action?: string };
  const prompt = String(body.prompt || "").trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt is verplicht" }, { status: 400 });
  }

  // Effective klant: if scope=all allow explicit or default to 'fumero' for chat flows; otherwise the scope itself
  const explicit = body.klant?.trim();
  const klant = auth.sessionScope === "all" ? (explicit || "fumero") : auth.sessionScope;

  // Fase 5: support refine on existing app via same generation path (preserves app_data)
  const targetSlug = (body.slug || "").trim();
  const isRefine = body.action === "refine" || !!targetSlug;
  if (isRefine && targetSlug) {
    const safeSlug = targetSlug.replace(/[^a-z0-9-]/gi, "").toLowerCase();
    const refineRes = await refineFullApp(safeSlug, klant, prompt);
    if ("error" in refineRes) {
      return NextResponse.json(
        { error: formatFumeroBuilderError(refineRes.error) },
        { status: 503 }
      );
    }
    return NextResponse.json({
      ok: true,
      app_id: refineRes.appId,
      slug: refineRes.slug,
      naam: refineRes.naam,
      tables: Array.isArray(refineRes.schema?.tables) ? refineRes.schema.tables.length : 0,
      refined: true,
    });
  }

  const result = await generateFullApp(prompt, klant);
  if ("error" in result) {
    return NextResponse.json(
      { error: formatFumeroBuilderError(result.error) },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    app_id: result.appId,
    slug: result.slug,
    naam: result.naam,
    tables: Array.isArray(result.schema?.tables) ? result.schema.tables.length : 0,
  });
}
