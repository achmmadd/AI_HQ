import { getAnthropicApiKey } from "@/lib/anthropic-messages";
import { isOpenRouterDirectConfigured } from "@/lib/openrouter-gateway";

export type CodeAgentProvider = "openrouter" | "anthropic";

/** Flagship coding/agent model op OpenRouter (mei 2026). */
export const DEFAULT_CODE_MODEL_OPENROUTER = "qwen/qwen3.7-max";

/** Kostenefficiënt alternatief via OpenRouter pareto router. */
export const PARETO_CODE_MODEL = "openrouter/pareto-code";

export const DEFAULT_CODE_MODEL_ANTHROPIC = "claude-sonnet-4-20250514";

export function resolveCodeAgentProvider(): CodeAgentProvider {
  const raw = process.env.MOTOR_CODE_PROVIDER?.trim().toLowerCase();
  if (raw === "anthropic") return "anthropic";
  if (raw === "openrouter") return "openrouter";
  if (isOpenRouterDirectConfigured()) return "openrouter";
  return "anthropic";
}

export function getMotorCodeModel(
  provider: CodeAgentProvider = resolveCodeAgentProvider()
): string {
  const explicit = process.env.MOTOR_CODE_MODEL?.trim();
  if (explicit) return explicit;
  if (provider === "openrouter") return DEFAULT_CODE_MODEL_OPENROUTER;
  return (
    process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_CODE_MODEL_ANTHROPIC
  );
}

export function isCodeAgentConfigured(): boolean {
  const provider = resolveCodeAgentProvider();
  if (provider === "openrouter") return isOpenRouterDirectConfigured();
  return Boolean(getAnthropicApiKey());
}
