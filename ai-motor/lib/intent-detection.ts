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

export function detectChatIntent(prompt: string): ChatIntent {
  const lower = prompt.toLowerCase().trim();

  if (
    /\b(bouw|maak app|maak een app|create app|build app|webapp|mini.?app)\b/i.test(
      lower
    )
  ) {
    return "build";
  }

  if (ACTION_KEYWORDS.some((kw) => lower.includes(kw))) {
    return "action";
  }

  return "question";
}

/**
 * Welke n8n-webhook voor chat (Factory vs entrepreneur agent).
 * Valt terug op factory-webhook als entrepreneur niet geconfigureerd is.
 */
export function resolveChatWebhookUrl(intent: ChatIntent): string {
  const entrepreneur =
    process.env.N8N_ENTREPRENEUR_WEBHOOK?.trim() ||
    process.env.N8N_ENTREPRENEUR_AGENT_WEBHOOK?.trim();

  if (intent === "action" && entrepreneur) {
    return entrepreneur;
  }

  return N8N_FACTORY_WEBHOOK;
}
