import { NextRequest, NextResponse } from "next/server";
import { requireApiAuthSession } from "@/lib/require-api-auth";
import {
  assertWorkspaceSlugAccess,
  applyPgWorkspaceContext,
} from "@/lib/workspace-context";
import {
  assertWorkspaceAdmin,
  isMembershipRole,
  removeMember,
  revokeInviteStub,
  updateMemberRole,
} from "@/lib/workspace-members";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ slug: string; memberId: string }> };

/** PATCH /api/workspaces/[slug]/members/[memberId] — update role (admin only). */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const { slug, memberId } = await params;
  const workspaceSlug = slug.trim().toLowerCase();

  const auth = await requireApiAuthSession(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = assertWorkspaceSlugAccess(auth.session, workspaceSlug);
  if (forbidden) return forbidden;

  const adminErr = assertWorkspaceAdmin(auth.session);
  if (adminErr) return adminErr;

  const body = (await req.json()) as { role?: string };
  if (!body.role || !isMembershipRole(body.role)) {
    return NextResponse.json(
      { error: "role moet admin, editor of viewer zijn" },
      { status: 400 }
    );
  }

  await applyPgWorkspaceContext(auth.session, workspaceSlug).catch((err) => {
    console.error("[members PATCH] applyPgWorkspaceContext:", err);
  });

  const updated = await updateMemberRole({
    workspaceSlug,
    memberId,
    role: body.role,
  });

  if (!updated) {
    return NextResponse.json({ error: "Lid niet gevonden" }, { status: 404 });
  }

  return NextResponse.json({ member: updated });
}

/** DELETE /api/workspaces/[slug]/members/[memberId] — remove member or revoke invite. */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const { slug, memberId } = await params;
  const workspaceSlug = slug.trim().toLowerCase();

  const auth = await requireApiAuthSession(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = assertWorkspaceSlugAccess(auth.session, workspaceSlug);
  if (forbidden) return forbidden;

  const adminErr = assertWorkspaceAdmin(auth.session);
  if (adminErr) return adminErr;

  await applyPgWorkspaceContext(auth.session, workspaceSlug).catch((err) => {
    console.error("[members DELETE] applyPgWorkspaceContext:", err);
  });

  const inviteRevoked = revokeInviteStub({
    workspaceSlug,
    inviteId: memberId,
  });
  if (inviteRevoked) {
    return NextResponse.json({ ok: true, revoked: "invite" });
  }

  const removed = await removeMember({ workspaceSlug, memberId });
  if (!removed) {
    return NextResponse.json({ error: "Lid niet gevonden" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, revoked: "member" });
}
