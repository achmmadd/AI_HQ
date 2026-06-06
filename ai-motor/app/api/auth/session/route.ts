import { NextRequest, NextResponse } from "next/server";
import { readAuthSession, TOKEN_COOKIE } from "@/lib/auth-session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token =
    req.cookies.get(TOKEN_COOKIE)?.value ||
    req.headers.get("x-motorsai-token")?.trim() ||
    req.headers.get("authorization")?.trim().replace(/^bearer\s+/i, "");
  const session = await readAuthSession(token || undefined);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return NextResponse.json({
    authenticated: true,
    user: {
      email: session.email,
      role: session.role,
      scope: session.scope,
      workspaceId: session.workspaceId ?? null,
      workspaceSlug: session.workspaceSlug ?? null,
      membershipRole: session.membershipRole ?? null,
    },
  });
}
