import { NextRequest, NextResponse } from "next/server";
import { readAuthSession } from "@/lib/auth-session";

export async function GET(req: NextRequest) {
  const headerToken = req.headers.get("x-token");
  const session = await readAuthSession(headerToken ?? undefined);
  if (session) {
    return NextResponse.json({
      authenticated: true,
      user: {
        email: session.email,
        role: session.role,
        scope: session.scope,
      },
    });
  }
  return NextResponse.json({ authenticated: false }, { status: 401 });
}
