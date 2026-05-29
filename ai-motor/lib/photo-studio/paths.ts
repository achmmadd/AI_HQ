import fs from "fs";
import path from "path";

const home = process.env.HOME || "/home/pietje";

export function photoStudioDataDir(): string {
  const dir = path.join(home, "AI_HQ", "data", "photo-studio");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function photoStudioPublicUrl(filename: string): string {
  return `/api/photo-studio/assets/${encodeURIComponent(filename)}`;
}
