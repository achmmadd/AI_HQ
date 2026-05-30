import { NextRequest, NextResponse } from "next/server";
import {
  deleteCodeSession,
  getCodeSession,
  getSessionMessages,
} from "@/lib/code-sessions";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const session = getCodeSession(id);
  if (!session) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const messages = getSessionMessages(id);
  return NextResponse.json({ session, messages });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  deleteCodeSession(id);
  return NextResponse.json({ ok: true });
}
