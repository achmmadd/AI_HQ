import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { getCampaignPack } from "@/lib/photo-studio/campaign/storage";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  const { id } = await ctx.params;
  const pack = getCampaignPack(id);
  if (!pack?.zip_path) {
    return NextResponse.json({ error: "Pack niet gevonden of ZIP ontbreekt." }, { status: 404 });
  }

  const buffer = await readFile(pack.zip_path);
  const filename = `${pack.sku}_${pack.goal}_campaign_pack.zip`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
