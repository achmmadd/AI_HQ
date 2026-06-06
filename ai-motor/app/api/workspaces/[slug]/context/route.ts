import { NextRequest, NextResponse } from "next/server";
import {
  getMasterContextByWorkspaceSlug,
  upsertMasterContext,
} from "@/lib/master-context";
import { requireApiAuthSession } from "@/lib/require-api-auth";
import {
  assertWorkspaceSlugAccess,
  applyPgWorkspaceContext,
  resolveWorkspaceIdBySlug,
} from "@/lib/workspace-context";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ slug: string }> };

/** GET /api/workspaces/[slug]/context — master context markdown for workspace. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const workspaceSlug = slug.trim().toLowerCase();

  const auth = await requireApiAuthSession(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = assertWorkspaceSlugAccess(auth.session, workspaceSlug);
  if (forbidden) return forbidden;

  await applyPgWorkspaceContext(auth.session, workspaceSlug).catch((err) => {
    console.error("[workspace-context GET] applyPgWorkspaceContext:", err);
  });

  const record = await getMasterContextByWorkspaceSlug(workspaceSlug);
  if (!record) {
    return NextResponse.json(
      { error: "Workspace niet gevonden" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    slug: record.workspaceSlug,
    workspace_id: record.workspaceId,
    content: record.content,
    updated_at: record.updatedAt,
  });
}

/** PATCH /api/workspaces/[slug]/context — update master context markdown. */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const workspaceSlug = slug.trim().toLowerCase();

  const auth = await requireApiAuthSession(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = assertWorkspaceSlugAccess(auth.session, workspaceSlug);
  if (forbidden) return forbidden;

  const body = (await req.json()) as { content?: string };
  if (typeof body.content !== "string") {
    return NextResponse.json(
      { error: "content (string) required" },
      { status: 400 }
    );
  }

  const workspaceId = await resolveWorkspaceIdBySlug(workspaceSlug);
  if (!workspaceId) {
    return NextResponse.json(
      { error: "Workspace niet gevonden" },
      { status: 404 }
    );
  }

  await applyPgWorkspaceContext(auth.session, workspaceSlug).catch((err) => {
    console.error("[workspace-context PATCH] applyPgWorkspaceContext:", err);
  });

  try {
    const record = await upsertMasterContext({
      workspaceSlug,
      workspaceId,
      content: body.content,
      updatedByUserId: auth.session.pgUserId ?? null,
    });

    return NextResponse.json({
      slug: record.workspaceSlug,
      workspace_id: record.workspaceId,
      content: record.content,
      updated_at: record.updatedAt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
