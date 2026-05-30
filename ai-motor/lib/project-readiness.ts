import { assertDifyConfigured } from "@/lib/artifact-html";
import { assertArtifactBuilderConfigured } from "@/lib/artifact-generate";
import { isOpenRouterDirectConfigured } from "@/lib/openrouter-gateway";

/** Minstens één generator-backend beschikbaar (Dify/OpenRouter/n8n; geen Anthropic tenzij env). */
export function assertProjectBuilderConfigured(): boolean {
  return assertArtifactBuilderConfigured();
}

export function projectBuilderStatus(): {
  ok: boolean;
  anthropic: boolean;
  dify: boolean;
  openrouter: boolean;
  n8n: boolean;
  hint: string;
} {
  const dify = assertDifyConfigured();
  const openrouter = isOpenRouterDirectConfigured();
  const n8n = true;
  const anthropic =
    process.env.MOTOR_BUILDER_USE_ANTHROPIC?.trim() === "1" &&
    Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  const ok = dify || openrouter || n8n;
  const hint = ok
    ? dify
      ? "Project-build: Dify → OpenRouter → n8n (Anthropic uit, tenzij MOTOR_BUILDER_USE_ANTHROPIC=1)."
      : openrouter
        ? "Project-build: OpenRouter (qwen) → n8n fallback."
        : "Project-build: n8n Factory + kennisbank."
    : "Geen builder-backend: zet DIFY_API_KEY of OPENROUTER_API_KEY (of start n8n).";
  return { ok, anthropic, dify, openrouter, n8n, hint };
}
