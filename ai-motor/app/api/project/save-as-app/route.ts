import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";
import { sendTelegramMessage } from "@/lib/telegram";
import {
  buildProjectSummary,
  linkAppToProject,
  upsertProjectResumeNote,
} from "@/lib/project-resume";
import {
  getProjectById,
  parseProjectFiles,
  parseProjectSpec,
} from "@/lib/project-store";
import { buildProjectPreviewHtml } from "@/lib/project-preview-html";
import { detectProjectStack } from "@/lib/project-stack";

export const runtime = "nodejs";

function cleanSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const projectId = Number(body?.project_id);
  const klant =
    typeof body?.klant === "string" && body.klant ? body.klant : "system";

  if (!Number.isFinite(projectId)) {
    return NextResponse.json({ error: "project_id required" }, { status: 400 });
  }

  const row = getProjectById(projectId);
  if (!row) {
    return NextResponse.json({ error: "project not found" }, { status: 404 });
  }

  const spec = parseProjectSpec(row);
  const files = parseProjectFiles(row);
  const stack = spec.stack ?? detectProjectStack("", spec);
  const previewHtml = buildProjectPreviewHtml(files, stack);
  const slug = cleanSlug(row.slug || spec.title);
  const naam = row.title || spec.title;

  try {
    const existing = db
      .prepare(`SELECT id FROM custom_apps WHERE slug = ?`)
      .get(slug) as { id: number } | undefined;

    let customAppId: number;
    if (existing) {
      db.prepare(
        `UPDATE custom_apps SET naam = ?, code = ?, klant = ? WHERE slug = ?`
      ).run(naam, previewHtml, klant, slug);
      customAppId = existing.id;
    } else {
      const result = db
        .prepare(
          `INSERT INTO custom_apps (naam, slug, code, klant) VALUES (?,?,?,?)`
        )
        .run(naam, slug, previewHtml, klant);
      customAppId = Number(result.lastInsertRowid);
    }

    linkAppToProject({
      appSlug: slug,
      buildProjectId: projectId,
      customAppId,
    });

    upsertProjectResumeNote(
      projectId,
      buildProjectSummary(spec, "opgeslagen als live app")
    );

    const base =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      "https://motorsai.app";
    void sendTelegramMessage(
      `Project opgeslagen als app: ${naam}\nLive: ${base}/apps/${slug}`
    );

    return NextResponse.json({
      id: customAppId,
      slug,
      url: `/apps/${slug}`,
      build_project_id: projectId,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
