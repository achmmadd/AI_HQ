import { NextRequest, NextResponse } from "next/server";
import {
  createSignedSessionToken,
  getAuthPassword,
  TOKEN_COOKIE,
} from "@/lib/auth-session";
import { logAudit } from "@/lib/audit-log";
import { authenticateUser, seedAuthUsersFromEnv } from "@/lib/auth-users";
import { enrichAuthSession } from "@/lib/workspace-context";

export const runtime = "nodejs";

function sessionUserResponse(session: Awaited<ReturnType<typeof enrichAuthSession>>) {
  return {
    email: session.email,
    role: session.role,
    scope: session.scope,
    workspaceId: session.workspaceId ?? null,
    workspaceSlug: session.workspaceSlug ?? null,
    membershipRole: session.membershipRole ?? null,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password =
    typeof body?.password === "string" ? body.password : "";

  seedAuthUsersFromEnv();

  const user = email ? authenticateUser(email, password) : null;
  if (user) {
    const session = await enrichAuthSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      scope: user.scope,
    });
    logAudit({
      actor: user.email,
      action: "login",
      userId: session.pgUserId ?? undefined,
      workspaceSlug: session.workspaceSlug,
    });
    const token = await createSignedSessionToken(session);
    const res = NextResponse.json({
      token,
      user: sessionUserResponse(session),
    });
    res.cookies.set(TOKEN_COOKIE, token, {
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    });
    return res;
  }

  // Backward compatibility: allow old shared password login when no email account is provided.
  if (password === getAuthPassword()) {
    const session = await enrichAuthSession({
      userId: null,
      email: "legacy@motorsai.local",
      role: "admin",
      scope: "all",
      legacy: true,
    });
    logAudit({
      actor: "operator",
      action: "login_legacy",
      workspaceSlug: session.workspaceSlug,
    });
    const token = await createSignedSessionToken(session);
    const res = NextResponse.json({ token, legacy: true, user: sessionUserResponse(session) });
    res.cookies.set(TOKEN_COOKIE, token, {
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    });
    return res;
  }

  return NextResponse.json(
    { error: "Incorrect email/password" },
    { status: 401 }
  );
}
