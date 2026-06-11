import { NextRequest } from "next/server";
import {
  appSessionCookieName,
  logoutResponse,
  revokeAppSession,
} from "@/lib/apps/app-auth";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const safe = slug.replace(/[^a-z0-9-]/gi, "").toLowerCase();
  const token = req.cookies.get(appSessionCookieName(safe))?.value;
  revokeAppSession(token);
  return logoutResponse(safe);
}
