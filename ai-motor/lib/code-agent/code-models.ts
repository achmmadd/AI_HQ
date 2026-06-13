import { getAnthropicApiKey } from "@/lib/anthropic-messages";
import { isOpenRouterDirectConfigured } from "@/lib/openrouter-gateway";

export type CodeAgentProvider = "openrouter" | "anthropic";

/** Heavy default for complex coding turns (OpenRouter). */
export const DEFAULT_CODE_MODEL_HEAVY = "anthropic/claude-sonnet-4.6";

/** Kostenefficiënt alternatief via OpenRouter pareto router. */
export const PARETO_CODE_MODEL = "openrouter/pareto-code";

/** @deprecated Prefer resolveCodeModelForTurn(); kept for artifact/chunked paths. */
export const DEFAULT_CODE_MODEL_OPENROUTER = DEFAULT_CODE_MODEL_HEAVY;

export const DEFAULT_CODE_MODEL_ANTHROPIC = "claude-sonnet-4-20250514";

export type CodeTurnContext = {
  message: string;
  historyLength?: number;
  turn?: number;
  openFilesCount?: number;
  hasTerminalOutput?: boolean;
  hasSelection?: boolean;
};

const HEAVY_TURN_RE =
  /\b(refactor|architect|implement|rewrite|migrate|debug|build fail|typescript error|multi.?file|nieuwe feature|from scratch|database schema|api endpoint|integrat)\b/i;

const LIGHT_TURN_RE =
  /\b(fix typo|rename|format|comment|simplify|kleine|quick fix|een regel|whitespace|indent|spelling)\b/i;

function isHeavyCodeTurn(ctx: CodeTurnContext): boolean {
  const msg = ctx.message.trim();
  const len = msg.length;

  if (len > 500) return true;
  if ((ctx.historyLength ?? 0) > 8) return true;
  if ((ctx.turn ?? 0) > 3) return true;
  if ((ctx.openFilesCount ?? 0) > 2) return true;
  if (ctx.hasTerminalOutput) return true;
  if (ctx.hasSelection && len > 120) return true;
  if (HEAVY_TURN_RE.test(msg)) return true;
  if (LIGHT_TURN_RE.test(msg) && len < 200) return false;
  return len > 150;
}

export function resolveCodeAgentProvider(): CodeAgentProvider {
  const raw = process.env.MOTOR_CODE_PROVIDER?.trim().toLowerCase();
  if (raw === "anthropic") return "anthropic";
  if (raw === "openrouter") return "openrouter";
  if (isOpenRouterDirectConfigured()) return "openrouter";
  return "anthropic";
}

/** Cost-aware model pick per turn (ECC cost-aware-llm-pipeline pattern). */
export function resolveCodeModelForTurn(
  ctx: CodeTurnContext,
  provider: CodeAgentProvider = resolveCodeAgentProvider()
): string {
  const explicit = process.env.MOTOR_CODE_MODEL?.trim();
  if (explicit) return explicit;

  if (provider === "anthropic") {
    return (
      process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_CODE_MODEL_ANTHROPIC
    );
  }

  if (process.env.MOTOR_CODE_ROUTING?.trim() === "fixed") {
    return DEFAULT_CODE_MODEL_HEAVY;
  }

  return isHeavyCodeTurn(ctx) ? DEFAULT_CODE_MODEL_HEAVY : PARETO_CODE_MODEL;
}

export function getMotorCodeModel(
  provider: CodeAgentProvider = resolveCodeAgentProvider()
): string {
  const explicit = process.env.MOTOR_CODE_MODEL?.trim();
  if (explicit) return explicit;
  if (provider === "openrouter") return DEFAULT_CODE_MODEL_HEAVY;
  return (
    process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_CODE_MODEL_ANTHROPIC
  );
}

export function isCodeAgentConfigured(): boolean {
  const provider = resolveCodeAgentProvider();
  if (provider === "openrouter") return isOpenRouterDirectConfigured();
  return Boolean(getAnthropicApiKey());
}
