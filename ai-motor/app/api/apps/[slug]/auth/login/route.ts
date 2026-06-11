import { NextRequest, NextResponse } from "next/server";
import {
  loginAppUser,
  createAppSession,
  sessionResponse,
  validateLoginInput,
} from "@/lib/apps/app-auth";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const body = await req.json().catch(() => ({}));
  const klant = typeof body?.klant === "string" ? body.klant.trim() : null;

  const input = validateLoginInput(body);
  if (!input.ok) {
    return NextResponse.json(
      { error: input.error, field: input.field },
      { status: 400 }
    );
  }

  const result = loginAppUser(slug, klant, input.email, input.password);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, field: result.field },
      { status: 401 }
    );
  }

  const token = createAppSession(result.user);
  return sessionResponse(result.user, token);
}
