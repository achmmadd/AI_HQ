import { NextRequest, NextResponse } from "next/server";
import { isValidSessionToken, TOKEN_COOKIE } from "@/lib/auth-session";

/**
 * Edge middleware: cookie/token presence only.
 * Postgres RLS (`app.workspace_id`) is set in Node route handlers via
 * `requireApiAuthSession` / `requireApiAuthForKlant` → `applyPgWorkspaceContext`.
 */

/** Zelfde waarde als cookie (base64 van wachtwoord-bytes); handig voor curl/scripts. */
function getSessionToken(request: NextRequest): string | undefined {
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

const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/api/auth/login",
  "/api/auth/verify",
  "/api/health",
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/embed")) return true;
  // PC-bridge register/poll/result blijft publiek; overige chat/conversations via route-auth + cookie.
  if (pathname.startsWith("/api/chat/bridge/")) return true;
  if (pathname === "/api/message-feedback") return true;
  if (pathname.startsWith("/api/cron/")) return true;
  if (pathname === "/api/inngest" || pathname.startsWith("/api/inngest/")) {
    return true;
  }
  if (pathname === "/api/upload") return true;
  // Publieke previews van gebouwde apps (deelbare URL; data is al “published” als live).
  if (pathname.startsWith("/apps/") && pathname.length > "/apps/".length) {
    return true;
  }
  return false;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = getSessionToken(request);
  if (!isValidSessionToken(token)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", request.url);
    login.searchParams.set("from", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|js|woff2?)$).*)",
  ],
};
