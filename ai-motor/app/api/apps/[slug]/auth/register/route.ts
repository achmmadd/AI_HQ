import { NextRequest, NextResponse } from "next/server";
import {
  registerAppUser,
  createAppSession,
  sessionResponse,
  validateRegisterInput,
} from "@/lib/apps/app-auth";

export const runtime = "nodejs";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const body = await req.json().catch(() => ({}));
  const klant = typeof body?.klant === "string" ? body.klant.trim() : null;

  const input = validateRegisterInput(body);
  if (!input.ok) {
    return NextResponse.json(
      { error: input.error, field: input.field },
      { status: 400 }
    );
  }

  const result = registerAppUser(slug, klant, input.email, input.password, true);
  if (!result.ok) {
    const status = result.field === "email" ? 409 : 400;
    return NextResponse.json(
      { error: result.error, field: result.field },
      { status }
    );
  }

  const token = createAppSession(result.user);
  return sessionResponse(result.user, token);
}
