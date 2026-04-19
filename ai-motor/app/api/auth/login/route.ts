import { NextRequest, NextResponse } from "next/server";
import {
  encodePasswordAsToken,
  getAuthPassword,
  TOKEN_COOKIE,
} from "@/lib/auth-session";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const password =
    typeof body?.password === "string" ? body.password : "";

  if (password !== getAuthPassword()) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const token = encodePasswordAsToken(getAuthPassword());
  const res = NextResponse.json({ token });
  res.cookies.set(TOKEN_COOKIE, token, {
    path: "/",
    maxAge: 60 * 60 * 24 * 14,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
  return res;
}
