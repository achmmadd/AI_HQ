export type AgentRosterEntry = {
  slug: string;
  label: string;
  /** Model of kanaal zoals in Factory OS */
  modelHint: string;
  description: string;
  /** Alleen waar van toepassing: vaste system prompt in repo */
  systemPromptVersion?: number;
  systemPromptSummary?: string;
};

/**
 * Hiërarchie + verwachte modellen (read-only in UI; logging gebruikt o.a. Intern, Analyst).
 */
export const AGENT_ROSTER: AgentRosterEntry[] = [
  {
    slug: "ceo",
    label: "CEO",
    modelHint: "OpenClaw / Optimus",
    description: "Strategische orchestratie en eindverantwoording.",
  },
  {
    slug: "teamleader",
    label: "Teamleader",
    modelHint: "Claude Haiku",
    description: "Coördinatie, prioriteit en kwaliteitsbewaking.",
  },
  {
    slug: "intern",
    label: "Intern",
    modelHint: "Factory OS / n8n (Ollama waar van toepassing)",
    description: "Uitvoering van workflows, content- en tool-calls.",
  },
  {
    slug: "junior",
    label: "Junior",
    modelHint:
      "DeepSeek V4 Flash (OpenRouter: deepseek/deepseek-v4-flash via JUNIOR_MODEL)",
    description: "Snellere concepten en ondersteunende taken.",
  },
  {
    slug: "senior",
    label: "Senior",
    modelHint: "Claude Sonnet (≤20%)",
    description: "Complexe redactie en multi-step redenering.",
  },
  {
    slug: "analyst",
    label: "Analyst",
    modelHint: "Claude Haiku",
    description: "Merk- en compliance-scores; geen juridisch advies.",
    systemPromptVersion: 1,
    systemPromptSummary:
      "JSON-scores voor merkrichtlijnen (0–100) en compliance (0–100); korte toelichtingen; geen juridische geldigheid.",
  },
  {
    slug: "bibliothecaris",
    label: "Bibliothecaris",
    modelHint:
      "Kimi K2.6 swarming (OpenRouter: moonshotai/kimi-k2.6 via KIMI_MODEL)",
    description:
      "Kennis-/KB-cluster agent voor retrieval en kwaliteitscontrole van chunks.",
  },
];

const bySlug = new Map(AGENT_ROSTER.map((a) => [a.slug, a]));
const byLabel = new Map(
  AGENT_ROSTER.map((a) => [a.label.toLowerCase(), a])
);

export function getAgentBySlug(slug: string): AgentRosterEntry | undefined {
  return bySlug.get(slug.trim().toLowerCase());
}

export function resolveAgentSlugFromLabel(label: string): string | undefined {
  return byLabel.get(label.trim().toLowerCase())?.slug;
}
