import { NextRequest, NextResponse } from "next/server";
import {
  getProjectById,
  parseProjectFiles,
  parseProjectSpec,
} from "@/lib/project-store";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const row = getProjectById(id);
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: row.id,
    slug: row.slug,
    title: row.title,
    klant: row.klant,
    spec: parseProjectSpec(row),
    files: parseProjectFiles(row),
    created_at: row.created_at,
    updated_at: row.updated_at,
  });
}
