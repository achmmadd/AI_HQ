import sharp from "sharp";
import path from "path";
import { writeFile } from "fs/promises";
import { PHOTO_STUDIO_ASPECTS } from "@/lib/photo-studio/variants";
import { photoStudioDataDir, photoStudioPublicUrl } from "@/lib/photo-studio/paths";
import type { PhotoStudioAspect } from "@/lib/photo-studio/types";

export type SavedVariant = {
  aspect: PhotoStudioAspect;
  width: number;
  height: number;
  file_path: string;
  public_url: string;
};

export async function resizeMasterToVariants(
  masterBuffer: Buffer,
  trackingId: string
): Promise<{ master_path: string; master_public_url: string; variants: SavedVariant[] }> {
  const dir = photoStudioDataDir();
  const masterName = `${trackingId}_master.jpg`;
  const masterPath = path.join(dir, masterName);
  const normalized = await sharp(masterBuffer).jpeg({ quality: 92 }).toBuffer();
  await writeFile(masterPath, normalized);

  const variants: SavedVariant[] = [];
  for (const spec of PHOTO_STUDIO_ASPECTS) {
    const outName = `${trackingId}_${spec.aspect}.jpg`;
    const outPath = path.join(dir, outName);
    const resized = await sharp(normalized)
      .resize(spec.width, spec.height, { fit: "cover", position: "centre" })
      .jpeg({ quality: 90 })
      .toBuffer();
    await writeFile(outPath, resized);
    variants.push({
      aspect: spec.aspect,
      width: spec.width,
      height: spec.height,
      file_path: outPath,
      public_url: photoStudioPublicUrl(outName),
    });
  }

  return {
    master_path: masterPath,
    master_public_url: photoStudioPublicUrl(masterName),
    variants,
  };
}

export async function saveMasterOnly(
  masterBuffer: Buffer,
  trackingId: string
): Promise<{ master_path: string; master_public_url: string; variants: SavedVariant[] }> {
  const dir = photoStudioDataDir();
  const masterName = `${trackingId}_master.jpg`;
  const masterPath = path.join(dir, masterName);
  const normalized = await sharp(masterBuffer).jpeg({ quality: 92 }).toBuffer();
  await writeFile(masterPath, normalized);

  return {
    master_path: masterPath,
    master_public_url: photoStudioPublicUrl(masterName),
    variants: [],
  };
}

export async function saveVideoMaster(
  videoBuffer: Buffer,
  trackingId: string
): Promise<{ master_path: string; master_public_url: string; variants: SavedVariant[] }> {
  const dir = photoStudioDataDir();
  const masterName = `${trackingId}_master.mp4`;
  const masterPath = path.join(dir, masterName);
  await writeFile(masterPath, videoBuffer);

  return {
    master_path: masterPath,
    master_public_url: photoStudioPublicUrl(masterName),
    variants: [],
  };
}
