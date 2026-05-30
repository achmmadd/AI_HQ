import { isBuildLikePrompt as baseBuildLike } from "@/lib/build-intent";

/** Uitbreiding voor horeca/single-file zonder root-owned build-intent.ts te patchen. */
export function isBuildLikePrompt(prompt: string): boolean {
  if (baseBuildLike(prompt)) return true;
  return /\b(qr\s*menu|menukaart|digitale\s*menu|html\s*bestand)\b/i.test(
    prompt.toLowerCase()
  );
}

export { isBuildLikePrompt as isBuildLikePromptBase } from "@/lib/build-intent";
