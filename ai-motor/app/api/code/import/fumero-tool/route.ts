import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import {
  createWorkspace,
  executorFilePath,
  parseCodeKlant,
  validateProjectSlug,
} from "@/lib/code-workspace";
import { callCodeExecutor, getCodeExecutorStatus } from "@/lib/code-executor";
import {
  getConceptVersion,
  getPublishedVersion,
  getToolById,
  getToolBySlug,
} from "@/lib/fumero/tools-db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  const execStatus = await getCodeExecutorStatus();
  if (!execStatus.nuc.reachable && !execStatus.bridge.online) {
    return NextResponse.json({ error: "Executor offline" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    klant?: string;
    slug?: string;
    tool?: number | string;
    from?: string;
  };

  const klant = parseCodeKlant(body.klant ?? "fumero");
  const slugParam = typeof body.slug === "string" ? body.slug.trim() : "";
  const toolIdRaw = body.tool;
  const toolId =
    typeof toolIdRaw === "number"
      ? toolIdRaw
      : typeof toolIdRaw === "string"
        ? parseInt(toolIdRaw, 10)
        : NaN;

  const tool =
    (slugParam ? getToolBySlug(slugParam) : undefined) ??
    (!Number.isNaN(toolId) ? getToolById(toolId) : undefined);

  if (!tool) {
    return NextResponse.json({ error: "Tool niet gevonden" }, { status: 404 });
  }

  const version =
    getConceptVersion(tool.id) ?? getPublishedVersion(tool.id);
  if (!version?.code?.trim()) {
    return NextResponse.json(
      { error: "Geen code beschikbaar voor deze tool" },
      { status: 404 }
    );
  }

  const nameRaw = tool.slug.trim().toLowerCase();
  const name = validateProjectSlug(nameRaw)
    ? nameRaw
    : `tool-${tool.id}`;

  try {
    const ws = await createWorkspace(klant, name);
    const rel = "index.html";
    const r = await callCodeExecutor({
      op: "write_file",
      path: executorFilePath(klant, ws.id, rel),
      content: version.code,
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: "Bestand schrijven mislukt" },
        { status: 503 }
      );
    }

    const url = `/code?klant=${encodeURIComponent(klant)}&workspace=${encodeURIComponent(ws.id)}&file=${encodeURIComponent(rel)}`;

    return NextResponse.json({
      ok: true,
      workspace: ws.id,
      klant,
      toolId: tool.id,
      toolName: tool.name,
      openFile: rel,
      url,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}
