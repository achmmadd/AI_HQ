import { NextRequest, NextResponse } from "next/server";
import { getPublishedApp } from "@/lib/apps/apps-db";
import {
  appSessionCookieName,
  readAppSessionFromCookie,
} from "@/lib/apps/app-auth";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const safe = slug.replace(/[^a-z0-9-]/gi, "").toLowerCase();
  const published = getPublishedApp(safe);
  if (!published) {
    return NextResponse.json({ error: "App niet gevonden" }, { status: 404 });
  }

  const cookie = req.cookies.get(appSessionCookieName(safe))?.value;
  const session = readAppSessionFromCookie(cookie, safe, published.klant);

  if (!session) {
    return NextResponse.json({
      authenticated: false,
      auth_required: published.auth_required === 1,
    });
  }

  return NextResponse.json({
    authenticated: true,
    auth_required: published.auth_required === 1,
    user: {
      id: session.userId,
      email: session.email,
      age_verified: session.ageVerified,
    },
  });
}
