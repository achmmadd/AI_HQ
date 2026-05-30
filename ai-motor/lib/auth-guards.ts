import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { readAuthSession, TOKEN_COOKIE, type WorkspaceScope } from "@/lib/auth-session";

function allowed(scope: WorkspaceScope, target: WorkspaceScope): boolean {
  return scope === "all" || scope === target;
}

function fallbackPath(scope: WorkspaceScope): string {
  if (scope === "fumero") return "/fumero/chat";
  if (scope === "bokas") return "/bokas";
  if (scope === "personal") return "/chat";
  return "/";
}

export async function requireWorkspacePage(target: WorkspaceScope, returnTo?: string): Promise<void> {
  const token = (await cookies()).get(TOKEN_COOKIE)?.value;
  const session = await readAuthSession(token);
  if (!session) {
    redirect(returnTo ? `/login?from=${encodeURIComponent(returnTo)}` : "/login");
  }
  if (!allowed(session.scope, target)) {
    redirect(fallbackPath(session.scope));
  }
}

export async function requireWorkspaceApi(
  req: NextRequest,
  target: WorkspaceScope
): Promise<{ ok: true; sessionScope: WorkspaceScope } | { ok: false; response: NextResponse }> {
  const token =
    req.cookies.get(TOKEN_COOKIE)?.value ||
    req.headers.get("x-motorsai-token")?.trim() ||
    req.headers.get("authorization")?.trim().replace(/^bearer\s+/i, "");
  const session = await readAuthSession(token || undefined);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!allowed(session.scope, target)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden for workspace" }, { status: 403 }),
    };
  }
  return { ok: true, sessionScope: session.scope };
}
