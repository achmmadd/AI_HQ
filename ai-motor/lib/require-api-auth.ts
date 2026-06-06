import { NextRequest, NextResponse } from "next/server";
import {
  assertScopeAccess,
  isValidSessionToken,
  readAuthSession,
  TOKEN_COOKIE,
  type AuthSession,
} from "@/lib/auth-session";
import { applyPgWorkspaceContext } from "@/lib/workspace-context";
import { shouldUsePostgres } from "@/lib/db/pg-flags";

export function getSessionToken(request: NextRequest): string | undefined {
  const cookie = request.cookies.get(TOKEN_COOKIE)?.value;
  if (cookie) return cookie;

  const header = request.headers.get("x-motorsai-token")?.trim();
  if (header) return header;

  const auth = request.headers.get("authorization")?.trim();
  if (auth?.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return undefined;
}

/** Route-level auth guard (Week 1 fallback when middleware.ts is not writable). */
export function requireApiAuth(
  request: NextRequest
): NextResponse | null {
  const token = getSessionToken(request);
  if (!isValidSessionToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** Auth + parsed session (voor scope checks). Sets PG RLS context when enabled. */
export async function requireApiAuthSession(
  request: NextRequest
): Promise<{ session: AuthSession } | NextResponse> {
  const token = getSessionToken(request);
  const session = await readAuthSession(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (shouldUsePostgres()) {
    await applyPgWorkspaceContext(session).catch((err) => {
      console.error("[require-api-auth] applyPgWorkspaceContext failed:", err);
    });
  }

  return { session };
}

/** Auth + tenant-scope: weigert cross-klant toegang met 403. Sets app.workspace_id for PG. */
export async function requireApiAuthForKlant(
  request: NextRequest,
  klant: string
): Promise<{ session: AuthSession } | NextResponse> {
  const token = getSessionToken(request);
  const session = await readAuthSession(token);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const scopeErr = assertScopeAccess(session, klant);
  if (scopeErr) return scopeErr;

  if (shouldUsePostgres()) {
    await applyPgWorkspaceContext(session, klant).catch((err) => {
      console.error("[require-api-auth] applyPgWorkspaceContext failed:", err);
    });
  }

  return { session };
}
