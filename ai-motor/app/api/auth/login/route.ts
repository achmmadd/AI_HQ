import { NextRequest, NextResponse } from "next/server";
import {
  createSignedSessionToken,
  getAuthPassword,
  TOKEN_COOKIE,
} from "@/lib/auth-session";
import { logAudit } from "@/lib/audit-log";
import { authenticateUser, seedAuthUsersFromEnv } from "@/lib/auth-users";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password =
    typeof body?.password === "string" ? body.password : "";

  seedAuthUsersFromEnv();

  const user = email ? authenticateUser(email, password) : null;
  if (user) {
    logAudit({ actor: user.email, action: "login" });
    const token = await createSignedSessionToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      scope: user.scope,
    });
    const res = NextResponse.json({
      token,
      user: {
        email: user.email,
        role: user.role,
        scope: user.scope,
      },
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
    logAudit({ actor: "operator", action: "login_legacy" });
    const token = await createSignedSessionToken({
      userId: null,
      email: "legacy@motorsai.local",
      role: "admin",
      scope: "all",
      legacy: true,
    });
    const res = NextResponse.json({ token, legacy: true });
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
