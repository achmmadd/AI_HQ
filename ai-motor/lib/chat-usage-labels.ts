import { usdToEur } from "@/lib/eur-cost";

export type ChatUsageDisplayKind =
  | "motor"
  | "turbo"
  | "onderzoek"
  | "automation"
  | "lokaal";

export type TokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
};

export function estimateTokens(text: string): number {
  const t = text.trim();
  if (!t) return 0;
  return Math.max(1, Math.ceil(t.length / 4));
}

export function estimatePromptTokens(
  prompt: string,
  context: { role: string; content: string }[] = []
): number {
  const ctxText = context.map((m) => m.content).join("\n");
  return estimateTokens(`${ctxText}\n${prompt}`);
}

export function chatUsageAgentLabel(opts: {
  agentMode: boolean;
  useResearch: boolean;
  routing: string;
}): string {
  if (opts.routing === "local_executor") return "motor-lokaal";
  if (opts.routing === "n8n") {
    return opts.agentMode ? "motor-turbo-automation" : "motor-automation";
  }
  if (opts.useResearch) return "motor-onderzoek";
  if (opts.agentMode) return "motor-turbo";
  return "motor-chat";
}

export function chatUsageDisplayKind(agentLabel: string): ChatUsageDisplayKind {
  if (agentLabel.includes("turbo")) return "turbo";
  if (agentLabel.includes("onderzoek")) return "onderzoek";
  if (agentLabel.includes("automation")) return "automation";
  if (agentLabel.includes("lokaal")) return "lokaal";
  if (agentLabel.includes("code")) return "motor";
  return "motor";
}

export function chatUsageDisplayName(kind: ChatUsageDisplayKind): string {
  switch (kind) {
    case "turbo":
      return "Turbo";
    case "onderzoek":
      return "Motor · web";
    case "automation":
      return "Automation";
    case "lokaal":
      return "Motor · lokaal";
    default:
      return "Motor";
  }
}

export function resolveUsageModel(
  model: string | null | undefined,
  openrouterModel?: string | null
): string {
  const or = openrouterModel?.trim();
  if (or) return or;
  const m = model?.trim();
  if (m && m !== "openrouter-direct" && m !== "openclaw-gateway") return m;
  return or || m || "motor-chat";
}

export function usageCostEur(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const costs: Record<string, { input: number; output: number }> = {
    "claude-sonnet-4-6": { input: 0.003, output: 0.015 },
    "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
    "deepseek-chat": { input: 0.00027, output: 0.0011 },
    "deepseek/deepseek-v4-pro": { input: 0.0005, output: 0.002 },
    "deepseek/deepseek-v4-flash": { input: 0.00006, output: 0.00022 },
    "qwen/qwen3.7-max": { input: 0.0025, output: 0.0075 },
    "openrouter:qwen/qwen3.7-max": { input: 0.0025, output: 0.0075 },
    "openrouter/pareto-code": { input: 0.0005, output: 0.002 },
    "openrouter:openrouter/pareto-code": { input: 0.0005, output: 0.002 },
    "perplexity/sonar-pro": { input: 0.003, output: 0.015 },
    "factory-os": { input: 0.001, output: 0.005 },
    ollama: { input: 0, output: 0 },
  };
  const c = costs[model] ?? costs["factory-os"];
  const usd =
    (promptTokens * c.input) / 1000 + (completionTokens * c.output) / 1000;
  return usdToEur(usd);
}

export function formatTokenUsageLine(opts: {
  model: string;
  promptTokens: number;
  completionTokens: number;
  kind: ChatUsageDisplayKind;
  costEur?: number;
}): string {
  const name = chatUsageDisplayName(opts.kind);
  const shortModel = opts.model.includes("/")
    ? opts.model.split("/").slice(-2).join("/")
    : opts.model;
  const total = opts.promptTokens + opts.completionTokens;
  const tokens =
    total > 0
      ? `${total.toLocaleString("nl-NL")} tokens`
      : "tokens —";
  const cost =
    opts.costEur != null && opts.costEur > 0
      ? ` · ~€${opts.costEur.toFixed(4)}`
      : "";
  return `${name} · ${shortModel} · ${tokens}${cost}`;
}
