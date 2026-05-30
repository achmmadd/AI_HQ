import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { createAuthUser, seedAuthUsersFromEnv } from "@/lib/auth-users";
import { readAuthSession } from "@/lib/auth-session";

export const runtime = "nodejs";

async function requireAdmin(req: NextRequest): Promise<NextResponse | null> {
  const token =
    req.cookies.get("motorsai_token")?.value ||
    req.headers.get("x-motorsai-token")?.trim();
  const session = await readAuthSession(token || undefined);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin" && session.scope !== "all") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;
  seedAuthUsersFromEnv();
  const users = db
    .prepare(
      "SELECT id, email, role, scope, active, created_at FROM auth_users ORDER BY email ASC"
    )
    .all();
  return NextResponse.json({ users });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin(req);
  if (denied) return denied;

  const body = await req.json();
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const role = body?.role;
  const scope = body?.scope;
  if (
    (role !== "admin" && role !== "fumero" && role !== "bokas") ||
    (scope !== "all" &&
      scope !== "fumero" &&
      scope !== "bokas" &&
      scope !== "personal")
  ) {
    return NextResponse.json({ error: "invalid role or scope" }, { status: 400 });
  }

  try {
    const user = createAuthUser({ email, password, role, scope });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "cannot create user" },
      { status: 400 }
    );
  }
}
