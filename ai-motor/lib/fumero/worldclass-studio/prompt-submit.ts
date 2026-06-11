import type { ContentStudioMediaType } from "@/lib/photo-studio/types";

export function resolveEffectivePrompt(
  prompt: string,
  refCount: number,
  mediaType: ContentStudioMediaType
): string {
  const trimmed = prompt.trim();
  if (trimmed) return trimmed;
  if (refCount > 0 && mediaType === "image") {
    return "Verbeter deze foto met professionele studio-kwaliteit.";
  }
  return "";
}

export function canSubmitGeneration(
  prompt: string,
  refCount: number,
  mediaType: ContentStudioMediaType,
  busy: boolean
): boolean {
  if (busy) return false;
  return resolveEffectivePrompt(prompt, refCount, mediaType).length > 0;
}
