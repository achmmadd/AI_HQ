import { NextRequest, NextResponse } from "next/server";
import { isValidSessionToken } from "@/lib/auth-session";

export async function GET(req: NextRequest) {
  const headerToken = req.headers.get("x-token");
  if (isValidSessionToken(headerToken ?? undefined)) {
    return NextResponse.json({ authenticated: true });
  }
  return NextResponse.json({ authenticated: false }, { status: 401 });
}
