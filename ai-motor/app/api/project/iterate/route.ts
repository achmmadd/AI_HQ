import { NextRequest, NextResponse } from "next/server";
import { patchProjectFiles } from "@/lib/project-generate";
import { projectBuilderStatus } from "@/lib/project-readiness";
import {
  buildProjectSummary,
  upsertProjectResumeNote,
} from "@/lib/project-resume";
import {
  getProjectById,
  parseProjectFiles,
  parseProjectSpec,
  updateProjectFiles,
} from "@/lib/project-store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const instruction =
    typeof body?.instruction === "string" ? body.instruction.trim() : "";
  const projectId =
    typeof body?.project_id === "number" ? body.project_id : null;
  const klant =
    typeof body?.klant === "string" && body.klant ? body.klant : "system";

  if (!instruction) {
    return NextResponse.json({ error: "instruction required" }, { status: 400 });
  }
  if (!projectId) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 });
  }

  const status = projectBuilderStatus();
  if (!status.ok) {
    return NextResponse.json(
      { error: "Project-builder niet geconfigureerd", hint: status.hint },
      { status: 503 }
    );
  }

  const row = getProjectById(projectId);
  if (!row) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const spec = parseProjectSpec(row);
  const currentFiles = parseProjectFiles(row);

  try {
    const files = await patchProjectFiles({
      spec,
      files: currentFiles,
      instruction,
      klant: row.klant || klant,
      projectId,
    });
    updateProjectFiles(projectId, files, spec);
    upsertProjectResumeNote(
      projectId,
      buildProjectSummary(spec, instruction)
    );
    return NextResponse.json({
      id: projectId,
      slug: row.slug,
      title: row.title,
      spec,
      files,
      builder: status,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
