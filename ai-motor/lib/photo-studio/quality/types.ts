export type QualityFormat = "1:1" | "4:5" | "9:16";

export type QualityCheckStatus = "pass" | "fail" | "warn";

export type QualityCheckResult = {
  id: string;
  criterion: string;
  status: QualityCheckStatus;
  score?: number;
  message: string;
};

/** Pixel bounding box (x/y = top-left). */
export type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SafeZoneMargins = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type SafeZoneDefinition = {
  format: QualityFormat;
  margins: SafeZoneMargins;
  /** Usable content area as normalized fractions (0–1). */
  contentRect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type RunQualityChecksOptions = {
  inputPath?: string;
  outputPath: string;
  format: QualityFormat;
  /** Optional product region for safe-zone and SSIM checks. */
  productBbox?: BoundingBox;
};
