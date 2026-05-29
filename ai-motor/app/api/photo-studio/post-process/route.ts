import { NextRequest, NextResponse } from "next/server";
import {
  applyBatchFilter,
  applyPostProcess,
  type PostProcessOp,
} from "@/lib/photo-studio/post-process/compositing";
import { ensurePhotoStudioSchema } from "@/lib/photo-studio/db-migrate";
import { requirePhotoStudioKlant } from "@/lib/photo-studio/workspace-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    klant?: string;
    generation_id?: number;
    generation_ids?: number[];
    op?: PostProcessOp;
  };

  const auth = await requirePhotoStudioKlant(req, body.klant);
  if (!auth.ok) return auth.response;

  ensurePhotoStudioSchema();

  if (body.op?.type === "batch_filter" && Array.isArray(body.generation_ids)) {
    const results = await applyBatchFilter(body.generation_ids, body.op);
    return NextResponse.json({ ok: true, results });
  }

  const generationId = Number(body.generation_id);
  if (!generationId || !body.op) {
    return NextResponse.json(
      { error: "generation_id en op zijn verplicht." },
      { status: 400 }
    );
  }

  const out = await applyPostProcess(generationId, body.op);
  return NextResponse.json({ ok: true, ...out });
}
