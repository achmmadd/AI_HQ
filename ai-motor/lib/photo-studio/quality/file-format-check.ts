import { stat } from "fs/promises";
import sharp from "sharp";
import type { QualityCheckResult } from "@/lib/photo-studio/quality/types";

const MAX_BYTES = 30 * 1024 * 1024;
const ALLOWED_FORMATS = new Set(["jpeg", "jpg", "png"]);

function isLikelySrgb(meta: sharp.Metadata): boolean {
  const space = String(meta.space ?? "").toLowerCase();
  if (space.includes("srgb")) return true;
  if (!meta.icc && (meta.format === "jpeg" || meta.format === "jpg")) return true;
  if (meta.icc) {
    const iccStr = meta.icc.toString("latin1").toLowerCase();
    if (iccStr.includes("srgb") || iccStr.includes("iec61966")) return true;
  }
  return space === "srgb" || space === "";
}

export async function checkFileFormat(imagePath: string): Promise<QualityCheckResult> {
  const [fileStat, meta] = await Promise.all([
    stat(imagePath),
    sharp(imagePath).metadata(),
  ]);

  const format = String(meta.format ?? "").toLowerCase();
  const issues: string[] = [];

  if (!ALLOWED_FORMATS.has(format)) {
    issues.push(`Formaat '${format || "onbekend"}' — alleen JPG/PNG toegestaan`);
  }

  if (fileStat.size > MAX_BYTES) {
    issues.push(
      `Bestandsgrootte ${(fileStat.size / (1024 * 1024)).toFixed(1)}MB overschrijdt 30MB limiet`
    );
  }

  const srgb = isLikelySrgb(meta);
  if (!srgb) {
    issues.push("Geen sRGB kleurruimte gedetecteerd");
  }

  if (issues.length === 0) {
    return {
      id: "S7",
      criterion: "File format",
      status: "pass",
      message: `${format.toUpperCase()}, ${(fileStat.size / 1024).toFixed(0)}KB, sRGB.`,
    };
  }

  const hardFail = issues.some(
    (m) => m.includes("JPG/PNG") || m.includes("30MB")
  );

  return {
    id: "S7",
    criterion: "File format",
    status: hardFail ? "fail" : "warn",
    message: issues.join("; "),
  };
}
