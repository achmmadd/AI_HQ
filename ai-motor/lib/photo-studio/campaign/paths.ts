/** Campaign pack file paths — ~/AI_HQ/data/fumero-campaigns/{packId}/ */
import fs from "fs";
import path from "path";

const home = process.env.HOME || "/home/pietje";

export function campaignDataRoot(): string {
  const dir = path.join(home, "AI_HQ", "data", "fumero-campaigns");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function campaignPackDir(packId: string): string {
  const dir = path.join(campaignDataRoot(), packId);
  for (const sub of ["static", "video", "refs"]) {
    const subDir = path.join(dir, sub);
    if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
  }
  return dir;
}

export function campaignZipPath(packId: string): string {
  return path.join(campaignDataRoot(), `${packId}.zip`);
}
