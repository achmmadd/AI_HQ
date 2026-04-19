import { NextRequest, NextResponse } from "next/server";
import { isValidSessionToken, TOKEN_COOKIE } from "@/lib/auth-session";

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
  if (pathname.startsWith("/api/chat")) return true;
  if (pathname.startsWith("/api/conversations")) return true;
  if (pathname === "/api/message-feedback") return true;
  if (pathname.startsWith("/api/cron/")) return true;
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

  const token = request.cookies.get(TOKEN_COOKIE)?.value;
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
