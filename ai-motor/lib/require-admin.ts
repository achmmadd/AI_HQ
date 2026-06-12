import { NextRequest, NextResponse } from "next/server";
import { requireApiAuthSession } from "@/lib/require-api-auth";
import type { AuthSession } from "@/lib/auth-session";

function isAdminSession(session: AuthSession): boolean {
  return (
    session.role === "admin" ||
    session.membershipRole === "admin" ||
    session.scope === "all"
  );
}

/** Admin-only API guard — destructive/read-sensitive routes. */
export async function requireAdminApi(
  req: NextRequest
): Promise<{ ok: true; session: AuthSession } | { ok: false; response: NextResponse }> {
  const auth = await requireApiAuthSession(req);
  if (auth instanceof NextResponse) {
    return { ok: false, response: auth };
  }
  if (!isAdminSession(auth.session)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Admin access required" }, { status: 403 }),
    };
  }
  return { ok: true, session: auth.session };
}
