/** fal.ai HTTP timeouts — keep in sync across callers and UI ETA hints. */
export const FAL_IMAGE_TXT2IMG_TIMEOUT_MS = 180_000;
export const FAL_IMAGE_EDIT_TIMEOUT_MS = 240_000;
export const FAL_VIDEO_TIMEOUT_MS = 300_000;

/** Content Studio progress bar estimates (slightly under fal caps). */
export const STUDIO_IMAGE_ETA_MS = 60_000;
export const STUDIO_VIDEO_ETA_MS = 180_000;

/** Campaign pack video phase — must match FAL_VIDEO_TIMEOUT_MS. */
export const CAMPAIGN_VIDEO_TIMEOUT_MS = FAL_VIDEO_TIMEOUT_MS;
