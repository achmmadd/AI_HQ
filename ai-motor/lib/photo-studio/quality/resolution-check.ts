import sharp from "sharp";
import type { QualityCheckResult, QualityFormat } from "@/lib/photo-studio/quality/types";

const PASS_MIN_LONGEST = 2048;
const FAIL_MAX_LONGEST = 1080;

const HIGH_RES_FORMATS: QualityFormat[] = ["1:1", "4:5"];

export async function checkResolution(
  imagePath: string,
  format: QualityFormat
): Promise<QualityCheckResult> {
  const meta = await sharp(imagePath).metadata();
  const width = meta.width ?? 0;
  const height = meta.height ?? 0;
  const longest = Math.max(width, height);

  if (width === 0 || height === 0) {
    return {
      id: "S3",
      criterion: "Resolution",
      status: "fail",
      score: 0,
      message: "Kan afmetingen niet bepalen.",
    };
  }

  const appliesHighRes = HIGH_RES_FORMATS.includes(format);
  let status: QualityCheckResult["status"];
  if (appliesHighRes) {
    if (longest >= PASS_MIN_LONGEST) status = "pass";
    else if (longest < FAIL_MAX_LONGEST) status = "fail";
    else status = "warn";
  } else {
    if (longest >= PASS_MIN_LONGEST) status = "pass";
    else if (longest < FAIL_MAX_LONGEST) status = "fail";
    else status = "warn";
  }

  const thresholdNote = appliesHighRes
    ? `≥${PASS_MIN_LONGEST}px pass, <${FAIL_MAX_LONGEST}px fail`
    : `≥${PASS_MIN_LONGEST}px pass, <${FAIL_MAX_LONGEST}px fail`;

  return {
    id: "S3",
    criterion: "Resolution",
    status,
    score: longest,
    message: `${width}×${height}px (langste zijde ${longest}px). ${thresholdNote}.`,
  };
}
