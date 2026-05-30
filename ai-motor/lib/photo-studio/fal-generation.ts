/**
 * @deprecated Import from `@/lib/photo-studio/fal` — re-export for existing callers.
 */
export {
  buildImageToImageFalPrompt,
  buildImageToImagePromptParts,
  buildTextToImageFalPrompt,
  buildTextToImagePromptParts,
  contentTypeForKlant,
  enrichImageToImagePrompt,
  enrichTextToImagePrompt,
  FAL_MODEL_REGISTRY,
  generateWithFal,
  generateWithModel,
  logFalPrompt,
  photoStudioPromptFixtures,
} from "@/lib/photo-studio/fal";
export type { PhotoStudioContentType } from "@/lib/photo-studio/fal";
