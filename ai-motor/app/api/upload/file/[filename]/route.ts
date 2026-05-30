import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ filename: string }> }
) {
  const { filename: raw } = await ctx.params;
  const filename = decodeURIComponent(raw);
  if (!filename || filename.includes("..") || filename.includes("/")) {
    return NextResponse.json({ error: "Ongeldig bestand." }, { status: 400 });
  }

  const home = process.env.HOME || "/home/pietje";
  const filepath = path.join(home, "AI_HQ", "uploads", filename);
  try {
    const buf = await readFile(filepath);
    const ext = path.extname(filename).toLowerCase();
    const contentType = MIME[ext] ?? "application/octet-stream";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Bestand niet gevonden." }, { status: 404 });
  }
}
