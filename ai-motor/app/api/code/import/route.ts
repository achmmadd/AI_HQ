import { NextRequest, NextResponse } from "next/server";
import {
  createWorkspace,
  executorFilePath,
  parseCodeKlant,
  validateProjectSlug,
} from "@/lib/code-workspace";
import { callCodeExecutor, getCodeExecutorStatus } from "@/lib/code-executor";

export const runtime = "nodejs";

function slugFromTitle(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return base || `import-${Date.now().toString(36)}`;
}

export async function POST(req: NextRequest) {
  const execStatus = await getCodeExecutorStatus();
  if (!execStatus.nuc.reachable && !execStatus.bridge.online) {
    return NextResponse.json({ error: "Executor offline" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const klant = parseCodeKlant(typeof body.klant === "string" ? body.klant : null);
  const title = typeof body.title === "string" ? body.title.trim() : "chat-import";
  const nameRaw =
    typeof body.name === "string" ? body.name.trim().toLowerCase() : slugFromTitle(title);
  const name = validateProjectSlug(nameRaw)
    ? nameRaw
    : slugFromTitle(title);
  const files =
    body.files && typeof body.files === "object" && !Array.isArray(body.files)
      ? (body.files as Record<string, string>)
      : null;

  if (!files || Object.keys(files).length === 0) {
    return NextResponse.json({ error: "files vereist" }, { status: 400 });
  }

  try {
    const ws = await createWorkspace(klant, name);
    const written: string[] = [];

    for (const [filePath, content] of Object.entries(files)) {
      if (typeof content !== "string") continue;
      const rel = filePath.replace(/^\/+/, "");
      if (!rel || rel.includes("..")) continue;
      const r = await callCodeExecutor({
        op: "write_file",
        path: executorFilePath(klant, ws.id, rel),
        content,
      });
      if (r.ok) written.push(rel);
    }

    const openFile =
      written.find((p) => p === "index.html") ??
      written.find((p) => p.endsWith(".html")) ??
      written[0] ??
      null;

    return NextResponse.json({
      ok: true,
      workspace: ws.id,
      klant,
      written,
      openFile,
      url: `/code?klant=${encodeURIComponent(klant)}&workspace=${encodeURIComponent(ws.id)}${openFile ? `&file=${encodeURIComponent(openFile)}` : ""}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}
