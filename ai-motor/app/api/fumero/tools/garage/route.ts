import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Garage data lives on GET /api/fumero/tools */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const target = new URL("/api/fumero/tools", url.origin);
  target.search = url.search;
  return fetch(target.toString(), {
    headers: { cookie: req.headers.get("cookie") ?? "" },
  });
}
