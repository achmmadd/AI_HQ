import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { photoStudioDataDir } from "@/lib/photo-studio/paths";
import { requireApiAuthSession } from "@/lib/require-api-auth";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ filename: string }> }
) {
  const auth = await requireApiAuthSession(req);
  if (auth instanceof NextResponse) return auth;

  const { filename } = await ctx.params;
  const decoded = decodeURIComponent(filename);
  const safe = path.basename(decoded);
  if (!safe) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }
  const filePath = path.join(photoStudioDataDir(), safe);
  try {
    const buf = await readFile(filePath);
    const ext = path.extname(safe).toLowerCase();
    const contentType =
      ext === ".mp4"
        ? "video/mp4"
        : ext === ".webp"
          ? "image/webp"
          : ext === ".png"
            ? "image/png"
            : "image/jpeg";
    return new NextResponse(buf, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
