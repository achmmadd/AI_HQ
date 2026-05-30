import { NextRequest, NextResponse } from "next/server";
import {
  createWorkspace,
  listWorkspaces,
  parseCodeKlant,
} from "@/lib/code-workspace";
import { isLocalExecutorConfigured } from "@/lib/local-executor";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const klant = parseCodeKlant(new URL(req.url).searchParams.get("klant"));
  if (!isLocalExecutorConfigured()) {
    return NextResponse.json(
      {
        error: "Local executor niet geconfigureerd",
        hint: "Zet LOCAL_EXECUTOR_URL en LOCAL_EXECUTOR_SECRET",
      },
      { status: 503 }
    );
  }
  try {
    const workspaces = await listWorkspaces(klant);
    return NextResponse.json({ klant, workspaces });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const klant = parseCodeKlant(
    typeof body.klant === "string" ? body.klant : null
  );
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name vereist" }, { status: 400 });
  }
  if (!isLocalExecutorConfigured()) {
    return NextResponse.json(
      { error: "Local executor niet geconfigureerd" },
      { status: 503 }
    );
  }
  try {
    const workspace = await createWorkspace(klant, name);
    return NextResponse.json(workspace);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}
