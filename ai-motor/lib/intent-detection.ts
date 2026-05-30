import { N8N_FACTORY_WEBHOOK } from "@/lib/chat-n8n";

const ACTION_KEYWORDS = [
  "bestel",
  "plaats order",
  "order plaatsen",
  "maak factuur",
  "stuur factuur",
  "factuur voor",
  "check orders",
  "controleer bestelling",
  "bekijk bestellingen",
  "stuur email",
  "mail naar",
  "verstuur naar",
  "open website",
  "bezoek ",
  "ga naar ",
  "zoek op ",
  "download ",
  "exporteer",
  "maak rapport",
];

export type ChatIntent = "action" | "question" | "build";

export type AgentChatRoutingSource = "factory" | "explicit" | "computer_use";

export type ChatWebhookTargetKind = "factory" | "agent";

export type ChatWebhookTarget = {
  kind: ChatWebhookTargetKind;
  url: string;
};

export function detectChatIntent(prompt: string): ChatIntent {
  const lower = prompt.toLowerCase().trim();

  if (
    /\b(bouw|maak app|maak een app|create app|build app|webapp|mini.?app)\b/i.test(
      lower,
    )
  ) {
    return "build";
  }

  if (ACTION_KEYWORDS.some((kw) => lower.includes(kw))) {
    return "action";
  }

  return "question";
}

export function explicitAgentWebhookFromEnv(): string {
  return (
    process.env.N8N_AGENT_WEBHOOK?.trim() ||
    process.env.N8N_AGENT_CHAT_WEBHOOK?.trim() ||
    process.env.MOTOR_AGENT_CHAT_WEBHOOK?.trim() ||
    ""
  );
}

/**
 * Kale OpenAPI-/admin-roots worden voor agent-chat niet als webhook beschouwd.
 */
export function isMisconfiguredAgentUrl(url: string): boolean {
  const u = url.trim();
  if (!u.length) return true;
  try {
    const parsed = new URL(u);
    const p = parsed.pathname.replace(/\/+$/, "");
    return /\/v\d+$/.test(p) && !p.includes("/webhook");
  } catch {
    return true;
  }
}

/** Hoe MotorsAI naar agent-modus webhooks routed (diag). */
export function resolveAgentChatRoutingSource(): AgentChatRoutingSource {
  if (explicitAgentWebhookFromEnv()) return "explicit";
  const computerUseRaw = process.env.COMPUTER_USE_URL?.trim() ?? "";
  if (computerUseRaw && !isMisconfiguredAgentUrl(computerUseRaw)) {
    return "computer_use";
  }
  return "factory";
}

/**
 * Doel-webhook voor chat — agent-kanaal wanneer `agent_mode` aan staat,
 * ook als het de Factory-URL is (zie `resolveAgentChatRoutingSource`).
 */
export function resolveChatWebhookTarget(
  intent: ChatIntent,
  opts?: { agentMode?: boolean },
): ChatWebhookTarget {
  const entrepreneur =
    process.env.N8N_ENTREPRENEUR_WEBHOOK?.trim() ||
    process.env.N8N_ENTREPRENEUR_AGENT_WEBHOOK?.trim();

  let defaultUrl = N8N_FACTORY_WEBHOOK;
  if (intent === "action" && entrepreneur) {
    defaultUrl = entrepreneur;
  }

  if (!opts?.agentMode) {
    return { kind: "factory", url: defaultUrl };
  }

  const explicit = explicitAgentWebhookFromEnv();
  if (explicit) {
    return { kind: "agent", url: explicit };
  }

  const computerUseRaw = process.env.COMPUTER_USE_URL?.trim() ?? "";
  if (computerUseRaw && !isMisconfiguredAgentUrl(computerUseRaw)) {
    return { kind: "agent", url: computerUseRaw };
  }

  return { kind: "agent", url: N8N_FACTORY_WEBHOOK };
}

/**
 * Gewone Factory-routing of agent-modus (eigen webhook / COMPUTER_USE_URL).
 */
export function resolveChatWebhookUrl(
  intent: ChatIntent,
  opts?: { agentMode?: boolean },
): string {
  return resolveChatWebhookTarget(intent, opts).url;
}
