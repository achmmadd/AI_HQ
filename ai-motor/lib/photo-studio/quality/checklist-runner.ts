import { checkFileFormat } from "@/lib/photo-studio/quality/file-format-check";
import { checkResolution } from "@/lib/photo-studio/quality/resolution-check";
import { checkSafeZone } from "@/lib/photo-studio/quality/safe-zone-check";
import { checkSsim } from "@/lib/photo-studio/quality/ssim-check";
import type {
  QualityCheckResult,
  RunQualityChecksOptions,
} from "@/lib/photo-studio/quality/types";

export async function runQualityChecks(
  options: RunQualityChecksOptions
): Promise<QualityCheckResult[]> {
  const { inputPath, outputPath, format, productBbox } = options;
  const results: QualityCheckResult[] = [];

  results.push(await checkResolution(outputPath, format));
  results.push(await checkSafeZone(outputPath, format, productBbox));
  results.push(await checkFileFormat(outputPath));

  if (inputPath) {
    results.push(await checkSsim(inputPath, outputPath, productBbox));
  }

  return results;
}
