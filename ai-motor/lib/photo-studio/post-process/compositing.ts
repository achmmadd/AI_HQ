import sharp from "sharp";
import path from "path";
import { readFile, writeFile } from "fs/promises";
import db from "@/lib/db/database";
import { photoStudioDataDir, photoStudioPublicUrl } from "@/lib/photo-studio/paths";
import { ensurePhotoStudioSchema } from "@/lib/photo-studio/db-migrate";

export type PostProcessOp =
  | { type: "background_swap"; background_url: string }
  | { type: "logo_watermark"; logo_url: string; opacity?: number }
  | { type: "text_overlay"; text: string; subtext?: string }
  | { type: "brightness_contrast"; brightness?: number; contrast?: number }
  | { type: "batch_filter"; filter: "brightness_contrast"; brightness?: number; contrast?: number };

async function loadBufferFromUrlOrPath(urlOrPath: string): Promise<Buffer> {
  if (urlOrPath.startsWith("/api/photo-studio/assets/")) {
    const name = decodeURIComponent(urlOrPath.split("/").pop() ?? "");
    return readFile(path.join(photoStudioDataDir(), path.basename(name)));
  }
  if (urlOrPath.startsWith("/api/upload/file/")) {
    const home = process.env.HOME || "/home/pietje";
    const name = decodeURIComponent(urlOrPath.split("/").pop() ?? "");
    return readFile(path.join(home, "AI_HQ", "uploads", path.basename(name)));
  }
  const res = await fetch(urlOrPath, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`Kan bron niet laden: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function generationMasterPath(generationId: number): string {
  ensurePhotoStudioSchema();
  const row = db
    .prepare(`SELECT master_path, master_url FROM photo_studio_generations WHERE id = ?`)
    .get(generationId) as { master_path: string | null; master_url: string } | undefined;
  if (!row?.master_path) throw new Error("Generatie niet gevonden");
  return row.master_path;
}

export async function applyPostProcess(
  generationId: number,
  op: PostProcessOp
): Promise<{ public_url: string; file_path: string }> {
  const masterPath = generationMasterPath(generationId);
  let buffer = await readFile(masterPath);

  if (op.type === "background_swap") {
    const bg = await loadBufferFromUrlOrPath(op.background_url);
    const fg = await sharp(buffer).resize(900, 900, { fit: "inside" }).png().toBuffer();
    const meta = await sharp(bg).metadata();
    const w = meta.width ?? 1080;
    const h = meta.height ?? 1080;
    const bgSized = await sharp(bg).resize(w, h, { fit: "cover" }).toBuffer();
    buffer = await sharp(bgSized)
      .composite([{ input: fg, gravity: "centre" }])
      .jpeg({ quality: 90 })
      .toBuffer();
  } else if (op.type === "logo_watermark") {
    const logo = await loadBufferFromUrlOrPath(op.logo_url);
    const meta = await sharp(buffer).metadata();
    const w = meta.width ?? 1080;
    const logoW = Math.round(w * 0.18);
    const logoBuf = await sharp(logo)
      .resize(logoW)
      .ensureAlpha()
      .modulate({ brightness: 1 })
      .toBuffer();
    buffer = await sharp(buffer)
      .composite([
        {
          input: logoBuf,
          gravity: "southeast",
          blend: "over",
        },
      ])
      .jpeg({ quality: 90 })
      .toBuffer();
  } else if (op.type === "text_overlay") {
    const meta = await sharp(buffer).metadata();
    const w = meta.width ?? 1080;
    const h = meta.height ?? 1080;
    const esc = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const svg = Buffer.from(`
      <svg width="${w}" height="${h}">
        <rect x="0" y="0" width="${w}" height="80" fill="rgba(0,0,0,0.35)"/>
        <text x="24" y="52" font-size="32" font-weight="700" fill="#fff" font-family="Arial">${esc(op.text.slice(0, 60))}</text>
        ${op.subtext ? `<text x="24" y="72" font-size="18" fill="#eee" font-family="Arial">${esc(op.subtext.slice(0, 80))}</text>` : ""}
      </svg>`);
    buffer = await sharp(buffer).composite([{ input: svg }]).jpeg({ quality: 90 }).toBuffer();
  } else if (op.type === "brightness_contrast") {
    const b = 1 + (op.brightness ?? 0) / 100;
    const c = op.contrast ?? 0;
    buffer = await sharp(buffer)
      .modulate({ brightness: b })
      .linear(1 + c / 100, -(128 * c) / 100)
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  const outName = `pp_${generationId}_${Date.now()}.jpg`;
  const outPath = path.join(photoStudioDataDir(), outName);
  await writeFile(outPath, buffer);
  const public_url = photoStudioPublicUrl(outName);

  db.prepare(`UPDATE photo_studio_generations SET master_url = ?, master_path = ? WHERE id = ?`).run(
    public_url,
    outPath,
    generationId
  );

  return { public_url, file_path: outPath };
}

export async function applyBatchFilter(
  generationIds: number[],
  filter: Extract<PostProcessOp, { type: "batch_filter" }>
): Promise<Array<{ generation_id: number; public_url?: string; error?: string }>> {
  const results: Array<{ generation_id: number; public_url?: string; error?: string }> = [];
  for (const id of generationIds) {
    try {
      const out = await applyPostProcess(id, {
        type: "brightness_contrast",
        brightness: filter.brightness,
        contrast: filter.contrast,
      });
      results.push({ generation_id: id, public_url: out.public_url });
    } catch (e) {
      results.push({
        generation_id: id,
        error: e instanceof Error ? e.message : "mislukt",
      });
    }
  }
  return results;
}
