import { NextRequest, NextResponse } from "next/server";
import "@/lib/startup-checks";
import {
  createCodeSession,
  listCodeSessions,
} from "@/lib/code-sessions";
import { isValidWorkspaceSlug } from "@/lib/code-workspace";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const klant = searchParams.get("klant")?.trim();
  const workspace = searchParams.get("workspace")?.trim();
  if (!klant || !workspace || !isValidWorkspaceSlug(workspace)) {
    return NextResponse.json({ error: "klant en workspace vereist" }, { status: 400 });
  }
  const sessions = listCodeSessions(klant, workspace);
  return NextResponse.json({ sessions });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const klant = String(body.klant ?? "").trim();
  const workspace = String(body.workspace ?? "").trim();
  const title = body.title != null ? String(body.title) : undefined;
  if (!klant || !workspace || !isValidWorkspaceSlug(workspace)) {
    return NextResponse.json({ error: "klant en workspace vereist" }, { status: 400 });
  }
  const session = createCodeSession(klant, workspace, title);
  return NextResponse.json({ session });
}
