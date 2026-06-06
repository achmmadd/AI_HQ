import { NextRequest, NextResponse } from "next/server";
import { requireApiAuthSession } from "@/lib/require-api-auth";
import {
  assertWorkspaceSlugAccess,
  applyPgWorkspaceContext,
} from "@/lib/workspace-context";
import {
  assertWorkspaceAdmin,
  createInviteStub,
  isMembershipRole,
  listPendingInvites,
  listWorkspaceMembers,
} from "@/lib/workspace-members";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ slug: string }> };

/** GET /api/workspaces/[slug]/members — team list + pending invite stubs. */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const workspaceSlug = slug.trim().toLowerCase();

  const auth = await requireApiAuthSession(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = assertWorkspaceSlugAccess(auth.session, workspaceSlug);
  if (forbidden) return forbidden;

  await applyPgWorkspaceContext(auth.session, workspaceSlug).catch((err) => {
    console.error("[members GET] applyPgWorkspaceContext:", err);
  });

  const [members, pending_invites] = await Promise.all([
    listWorkspaceMembers(workspaceSlug),
    Promise.resolve(listPendingInvites(workspaceSlug)),
  ]);

  return NextResponse.json({
    slug: workspaceSlug,
    members,
    pending_invites,
    invite_email_enabled: false,
  });
}

/** POST /api/workspaces/[slug]/members — create invite stub (admin only). */
export async function POST(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;
  const workspaceSlug = slug.trim().toLowerCase();

  const auth = await requireApiAuthSession(req);
  if (auth instanceof NextResponse) return auth;

  const forbidden = assertWorkspaceSlugAccess(auth.session, workspaceSlug);
  if (forbidden) return forbidden;

  const adminErr = assertWorkspaceAdmin(auth.session);
  if (adminErr) return adminErr;

  const body = (await req.json()) as { email?: string; role?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "Geldig e-mailadres verplicht" },
      { status: 400 }
    );
  }

  const role = body.role ?? "viewer";
  if (!isMembershipRole(role)) {
    return NextResponse.json(
      { error: "role moet admin, editor of viewer zijn" },
      { status: 400 }
    );
  }

  await applyPgWorkspaceContext(auth.session, workspaceSlug).catch((err) => {
    console.error("[members POST] applyPgWorkspaceContext:", err);
  });

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      process.env.MOTORSAI_BASE_URL?.trim() ||
      new URL(req.url).origin;

    const invite = await createInviteStub({
      workspaceSlug,
      email,
      role,
      baseUrl,
    });

    return NextResponse.json(
      {
        invite,
        message:
          "Uitnodiging aangemaakt (stub). E-mail wordt nog niet verstuurd — deel de link handmatig.",
        invite_email_enabled: false,
      },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
