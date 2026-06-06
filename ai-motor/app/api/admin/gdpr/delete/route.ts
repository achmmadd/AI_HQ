import { NextRequest, NextResponse } from "next/server";
import { logAudit } from "@/lib/audit-log";
import {
  canPerformGdprAction,
  deleteWorkspaceData,
} from "@/lib/gdpr";
import { requireApiAuthSession } from "@/lib/require-api-auth";
import {
  assertWorkspaceSlugAccess,
  resolveWorkspaceIdBySlug,
} from "@/lib/workspace-context";

export const runtime = "nodejs";

const PROTECTED_SLUGS = new Set(["motor"]);

/**
 * POST /api/admin/gdpr/delete — workspace-scoped GDPR erasure (tenant PII data).
 * Body: { workspace_slug: string, confirm: true }
 */
export async function POST(req: NextRequest) {
  const auth = await requireApiAuthSession(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json()) as {
    workspace_slug?: string;
    confirm?: boolean;
  };
  const workspaceSlug = (body.workspace_slug ?? "").trim().toLowerCase();
  if (!workspaceSlug) {
    return NextResponse.json(
      { error: "workspace_slug required" },
      { status: 400 }
    );
  }

  if (body.confirm !== true) {
    return NextResponse.json(
      { error: "confirm: true required voor GDPR-verwijdering" },
      { status: 400 }
    );
  }

  if (PROTECTED_SLUGS.has(workspaceSlug)) {
    return NextResponse.json(
      { error: "Motor-shell workspace kan niet via GDPR worden gewist" },
      { status: 400 }
    );
  }

  const forbidden = assertWorkspaceSlugAccess(auth.session, workspaceSlug);
  if (forbidden) return forbidden;

  if (!canPerformGdprAction(auth.session, workspaceSlug)) {
    return NextResponse.json(
      { error: "Forbidden: admin-rechten vereist voor GDPR-verwijdering" },
      { status: 403 }
    );
  }

  const workspaceId = await resolveWorkspaceIdBySlug(workspaceSlug);
  if (!workspaceId) {
    return NextResponse.json(
      { error: "Workspace niet gevonden" },
      { status: 404 }
    );
  }

  const result = await deleteWorkspaceData(workspaceSlug);

  logAudit({
    actor: auth.session.email,
    userId: auth.session.pgUserId ?? null,
    action: "gdpr.delete",
    resource: `workspace:${workspaceSlug}`,
    detail: {
      workspace_id: workspaceId,
      sqlite_deleted: result.sqlite_deleted,
      postgres_deleted: result.postgres_deleted,
    },
    klant:
      workspaceSlug === "fumero" || workspaceSlug === "bokas"
        ? workspaceSlug
        : null,
    workspaceSlug,
  });

  return NextResponse.json({
    ok: true,
    ...result,
  });
}
