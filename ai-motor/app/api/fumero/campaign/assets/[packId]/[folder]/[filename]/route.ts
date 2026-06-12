import { NextRequest, NextResponse } from "next/server";
import { readFile, stat } from "fs/promises";
import path from "path";
import { requireWorkspaceApi } from "@/lib/auth-guards";
import { campaignPackDir } from "@/lib/photo-studio/campaign/paths";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ packId: string; folder: string; filename: string }> }
) {
  const auth = await requireWorkspaceApi(req, "fumero");
  if (!auth.ok) return auth.response;

  const { packId, folder, filename } = await ctx.params;
  if (folder !== "static" && folder !== "video") {
    return NextResponse.json({ error: "Ongeldige map." }, { status: 400 });
  }

  const safeName = path.basename(filename);
  const filePath = path.join(campaignPackDir(packId), folder, safeName);

  try {
    await stat(filePath);
  } catch {
    return NextResponse.json({ error: "Bestand niet gevonden." }, { status: 404 });
  }

  const buffer = await readFile(filePath);
  const contentType =
    safeName.endsWith(".mp4") ? "video/mp4" : "image/jpeg";

  return new NextResponse(buffer, {
    headers: { "Content-Type": contentType, "Cache-Control": "private, max-age=3600" },
  });
}
