import { NextRequest, NextResponse } from "next/server";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import {
  archiveTool,
  duplicateToolVersion,
  getToolDetail,
  publishTool,
  updateConceptCode,
} from "@/lib/fumero/tools-service";
import { formatFumeroBuilderError } from "@/lib/fumero/builder-config";
import db from "@/lib/db/database";
import { getToolById } from "@/lib/fumero/tools-db";
import type { FumeroDeployType } from "@/lib/fumero/tool-templates";
import {
  fumeroCustomerEmbedCode,
  fumeroInternalAppUrl,
  fumeroPreviewPath,
  fumeroWidgetEmbedCode,
} from "@/lib/fumero/public-url";

export const runtime = "nodejs";

function parseId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return Number.isNaN(id) ? null : id;
}

function serializeToolDetail(id: number) {
  const detail = getToolDetail(id);
  if (!detail) return null;
  const { tool, versions, concept, published } = detail;
  const stats = versions.reduce(
    (acc, v) => ({
      views: acc.views + Number(v.stats_views || 0),
      interactions: acc.interactions + Number(v.stats_interactions || 0),
    }),
    { views: 0, interactions: 0 }
  );
  return {
    tool: {
      id: tool.id,
      name: tool.name,
      slug: tool.slug,
      deploy_type: tool.deploy_type,
      template_id: tool.template_id,
      archived: tool.archived === 1,
    },
    versions,
    concept: concept
      ? {
          id: concept.id,
          version: concept.version,
          prompt: concept.prompt,
        }
      : null,
    published: published
      ? { id: published.id, version: published.version }
      : null,
    preview_url: concept
      ? fumeroPreviewPath(tool.id, concept.id)
      : published
        ? fumeroPreviewPath(tool.id, published.id)
        : null,
    embed_code:
      tool.deploy_type === "widget"
        ? fumeroWidgetEmbedCode(tool.slug)
        : tool.deploy_type === "customer"
          ? fumeroCustomerEmbedCode(tool.slug)
          : null,
    internal_url:
      tool.deploy_type === "internal" ? fumeroInternalAppUrl(tool.slug) : null,
    stats_views: stats.views,
    stats_interactions: stats.interactions,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (id == null) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const payload = serializeToolDetail(id);
  if (!payload) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(payload);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  const { id: idStr } = await params;
  const id = parseId(idStr);
  if (id == null) return NextResponse.json({ error: "invalid id" }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    prompt?: string;
    code?: string;
    iterate?: boolean;
    deploy_type?: FumeroDeployType;
    action?: "publish" | "duplicate" | "archive" | "preview";
    from_version_id?: number;
  };

  if (body.action === "archive") {
    const r = archiveTool(id);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "publish") {
    const r = publishTool(id);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    const payload = serializeToolDetail(id);
    return NextResponse.json({ ok: true, ...(payload ?? {}) });
  }

  if (body.action === "duplicate") {
    const r = duplicateToolVersion(id, body.from_version_id);
    if ("error" in r) return NextResponse.json({ error: r.error }, { status: 400 });
    const payload = serializeToolDetail(id);
    return NextResponse.json({
      ok: true,
      version_id: r.versionId,
      ...(payload ?? {}),
    });
  }

  const tool = getToolById(id);
  if (!tool) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (typeof body.name === "string" && body.name.trim()) {
    db.prepare(`UPDATE fumero_tools SET name = ?, updated_at = datetime('now') WHERE id = ?`).run(
      body.name.trim(),
      id
    );
  }
  if (body.deploy_type) {
    db.prepare(
      `UPDATE fumero_tools SET deploy_type = ?, updated_at = datetime('now') WHERE id = ?`
    ).run(body.deploy_type, id);
  }

  if (body.prompt != null) {
    const updated = await updateConceptCode(id, String(body.prompt), body.code, {
      iterate: body.iterate !== false,
    });
    if ("error" in updated) {
      return NextResponse.json(
        { error: formatFumeroBuilderError(updated.error) },
        { status: 503 }
      );
    }
    return NextResponse.json({
      ok: true,
      version: updated.version,
      preview_url: fumeroPreviewPath(id, updated.version.id),
    });
  }

  const payload = serializeToolDetail(id);
  return NextResponse.json({ ok: true, ...(payload ?? {}) });
}
