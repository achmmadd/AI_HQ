import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { requireScopedWorkspaceApi } from "@/lib/auth-guards";
import { ensureAppsSchema, getAppBySlug } from "@/lib/apps/apps-db";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const auth = await requireScopedWorkspaceApi(req);
  if (!auth.ok) return auth.response;

  ensureAppsSchema();
  const klant = auth.sessionScope === "all" ? "fumero" : auth.sessionScope;

  // Fase 5: prefer new apps table (for full-stack App Factory cards/garage)
  const newApp = getAppBySlug(slug, klant);
  if (newApp) {
    return NextResponse.json({ app: newApp, source: "apps" });
  }

  const app = db
    .prepare("SELECT * FROM custom_apps WHERE slug = ?")
    .get(slug) as Record<string, unknown> | undefined;
  if (!app) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ app, source: "custom_apps" });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  db.prepare("DELETE FROM custom_apps WHERE slug = ?").run(slug);
  return NextResponse.json({ ok: true });
}

// Fase 5: publish action for apps (used by card Deploy)
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const auth = await requireScopedWorkspaceApi(req);
  if (!auth.ok) return auth.response;

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const klant = auth.sessionScope === "all" ? "fumero" : auth.sessionScope;

  if (body.action === "publish") {
    ensureAppsSchema();
    const safe = slug.replace(/[^a-z0-9-]/gi, "").toLowerCase();
    const res = db
      .prepare(
        `UPDATE apps SET status = 'published', updated_at = datetime('now')
         WHERE slug = ? AND klant = ? AND status != 'archived'`
      )
      .run(safe, klant);
    if (res.changes === 0) {
      return NextResponse.json({ error: "App niet gevonden of al gepubliceerd" }, { status: 404 });
    }
    const updated = getAppBySlug(safe, klant);
    return NextResponse.json({ ok: true, app: updated });
  }

  return NextResponse.json({ error: "unsupported action" }, { status: 400 });
}
