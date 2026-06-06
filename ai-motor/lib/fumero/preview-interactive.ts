/** Sandbox attrs voor speelbare HTML-apps in iframe (games, widgets, forms). */
export const PLAYABLE_PREVIEW_SANDBOX =
  "allow-scripts allow-same-origin allow-forms allow-popups allow-pointer-lock";

/** Of een preview-URL een statische concept-placeholder is (geen echte app). */
export function isStaticPreviewPlaceholder(url: string | null | undefined): boolean {
  if (!url) return true;
  if (url.startsWith("data:text/html")) return true;
  return false;
}

/** Of de preview direct klikbaar/speelbaar hoort te zijn. */
export function isInteractivePreview(opts: {
  previewUrl: string | null | undefined;
  status: "generating" | "ready";
  building?: boolean;
}): boolean {
  if (opts.status === "generating" || opts.building) return false;
  if (!opts.previewUrl || isStaticPreviewPlaceholder(opts.previewUrl)) return false;
  return true;
}
