import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit-log";
import {
  canPerformGdprAction,
  exportWorkspaceData,
} from "@/lib/gdpr";
import { requireApiAuthSession } from "@/lib/require-api-auth";
import {
  assertWorkspaceSlugAccess,
  resolveWorkspaceIdBySlug,
} from "@/lib/workspace-context";

export const runtime = "nodejs";

/**
 * POST /api/admin/gdpr/export — workspace-scoped GDPR data export (JSON bundle).
 * Body: { workspace_slug: string }
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiAuthSession(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as { workspace_slug?: string };
  const workspaceSlug = (body.workspace_slug ?? "").trim().toLowerCase();
  if (!workspaceSlug) {
    return NextResponse.json(
      { error: "workspace_slug required" },
      { status: 400 }
    );
  }

  const forbidden = assertWorkspaceSlugAccess(auth.session, workspaceSlug);
  if (forbidden) return forbidden;

  if (!canPerformGdprAction(auth.session, workspaceSlug)) {
    return NextResponse.json(
      { error: "Forbidden: admin-rechten vereist voor GDPR-export" },
      { status: 403 }
    );
  }

  const workspaceId = await resolveWorkspaceIdBySlug(workspaceSlug);
  if (!workspaceId && workspaceSlug !== "motor") {
    return NextResponse.json(
      { error: "Workspace niet gevonden" },
      { status: 404 }
    );
  }

  const bundle = await exportWorkspaceData(workspaceSlug);

  logAudit({
    actor: auth.session.email,
    userId: auth.session.pgUserId ?? null,
    action: "gdpr.export",
    resource: `workspace:${workspaceSlug}`,
    detail: {
      workspace_id: workspaceId,
      sqlite_tables: Object.keys(bundle.sqlite),
      postgres_tables: bundle.postgres ? Object.keys(bundle.postgres) : [],
    },
    klant:
      workspaceSlug === "fumero" || workspaceSlug === "bokas"
        ? workspaceSlug
        : null,
    workspaceSlug,
  });

  return NextResponse.json(bundle);
}
