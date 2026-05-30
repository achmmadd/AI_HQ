import { NextRequest, NextResponse } from "next/server";
import {
  buildFileTree,
  executorFilePath,
  parseCodeKlant,
  resolveFileAbs,
  validateProjectSlug,
} from "@/lib/code-workspace";
import { callCodeExecutor } from "@/lib/code-executor";
import { logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const klant = parseCodeKlant(sp.get("klant"));
  const workspace = sp.get("workspace")?.trim() ?? "";
  const filePath = sp.get("path");
  const tree = sp.get("tree");

  if (!workspace || !validateProjectSlug(workspace)) {
    return NextResponse.json({ error: "workspace vereist" }, { status: 400 });
  }

  try {
    if (tree === "1") {
      const structure = await buildFileTree(klant, workspace);
      return NextResponse.json({ tree: structure, workspace, klant });
    }

    if (filePath) {
      const r = await callCodeExecutor({
        op: "read_file",
        path: executorFilePath(klant, workspace, filePath),
      });
      if (!r.ok) {
        return NextResponse.json(
          { error: r.error ?? "read failed" },
          { status: 404 }
        );
      }
      return NextResponse.json({
        content: String(r.data?.content ?? ""),
        path: filePath,
      });
    }

    return NextResponse.json(
      { error: "Geef path of tree=1 mee" },
      { status: 400 }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const klant = parseCodeKlant(typeof body.klant === "string" ? body.klant : null);
  const workspace =
    typeof body.workspace === "string" ? body.workspace.trim() : "";
  const action =
    typeof body.action === "string" ? body.action.trim() : "write";
  const filePath = typeof body.path === "string" ? body.path.trim() : "";
  const content = typeof body.content === "string" ? body.content : "";
  const newPath = typeof body.newPath === "string" ? body.newPath.trim() : "";

  if (!workspace || !validateProjectSlug(workspace)) {
    return NextResponse.json({ error: "workspace vereist" }, { status: 400 });
  }

  try {
    if (action === "mkdir") {
      if (!filePath) {
        return NextResponse.json({ error: "path vereist" }, { status: 400 });
      }
      const fsMod = await import("fs/promises");
      await fsMod.mkdir(resolveFileAbs(klant, workspace, filePath), {
        recursive: true,
      });
      return NextResponse.json({ ok: true, path: filePath });
    }

    if (action === "delete") {
      if (!filePath) {
        return NextResponse.json({ error: "path vereist" }, { status: 400 });
      }
      const abs = resolveFileAbs(klant, workspace, filePath);
      const fs = await import("fs/promises");
      await fs.rm(abs, { force: true });
      logAudit({
        action: "code_file_delete",
        resource: filePath,
        klant,
        detail: { workspace },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "rename") {
      if (!filePath || !newPath) {
        return NextResponse.json(
          { error: "path en newPath vereist" },
          { status: 400 }
        );
      }
      const fs = await import("fs/promises");
      await fs.rename(
        resolveFileAbs(klant, workspace, filePath),
        resolveFileAbs(klant, workspace, newPath)
      );
      return NextResponse.json({ ok: true, path: newPath });
    }

    if (!filePath) {
      return NextResponse.json({ error: "path vereist" }, { status: 400 });
    }

    resolveFileAbs(klant, workspace, filePath);
    const r = await callCodeExecutor({
      op: "write_file",
      path: executorFilePath(klant, workspace, filePath),
      content,
    });
    if (!r.ok) {
      return NextResponse.json(
        { error: r.error ?? "write failed" },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true, path: filePath });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const klant = parseCodeKlant(sp.get("klant"));
  const workspace = sp.get("workspace")?.trim() ?? "";
  const filePath = sp.get("path")?.trim() ?? "";
  if (!workspace || !filePath) {
    return NextResponse.json({ error: "workspace en path vereist" }, { status: 400 });
  }
  try {
    const fs = await import("fs/promises");
    await fs.rm(resolveFileAbs(klant, workspace, filePath), { force: true });
    logAudit({ action: "code_file_delete", resource: filePath, klant });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 400 }
    );
  }
}
