import { NextRequest, NextResponse } from "next/server";
import { createProjectFromPrompt } from "@/lib/project-generate";
import { projectBuilderStatus } from "@/lib/project-readiness";
import { requireApiAuthForKlant } from "@/lib/require-api-auth";
import {
  buildProjectSummary,
  upsertProjectResumeNote,
} from "@/lib/project-resume";
import {
  insertProject,
  toSlugBase,
} from "@/lib/project-store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const klant =
    typeof body?.klant === "string" && body.klant ? body.klant : "system";
  const conversationId =
    typeof body?.conversation_id === "number" ? body.conversation_id : null;

  const auth = await requireApiAuthForKlant(req, klant);
  if (auth instanceof NextResponse) return auth;

  if (!prompt) {
    return NextResponse.json({ error: "prompt required" }, { status: 400 });
  }

  const status = projectBuilderStatus();
  if (!status.ok) {
    return NextResponse.json(
      {
        error: "Project-builder niet geconfigureerd",
        hint:
          "Builder: Dify → OpenRouter → n8n Factory. Anthropic uit (MOTOR_BUILDER_USE_ANTHROPIC=1 om aan te zetten).",
      },
      { status: 503 }
    );
  }

  try {
    const { spec, files } = await createProjectFromPrompt({
      prompt,
      klant,
      conversationId,
    });
    const slug = `${toSlugBase(spec.title)}-${Date.now().toString(36)}`;
    const id = insertProject({
      title: spec.title,
      slug,
      klant,
      spec,
      files,
      conversationId,
    });

    upsertProjectResumeNote(id, buildProjectSummary(spec, prompt));

    return NextResponse.json({
      id,
      slug,
      title: spec.title,
      spec,
      files,
      builder: status,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
