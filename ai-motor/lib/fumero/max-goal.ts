import {
  getMotorUserContext,
  upsertMotorUserContext,
  type MotorUserContext,
} from "@/lib/motor-user-context";

export {
  FUMERO_GOAL_UPDATED_EVENT,
  dispatchFumeroGoalUpdated,
  parseMaxGoalCommand,
  bouwenClarifyingQuestions,
  formatBouwenClarifyAssistantMessage,
  buildMaxClarifyChatPrompt,
  type ParsedGoalCommand,
} from "@/lib/fumero/max-goal-shared";

import type { ParsedGoalCommand } from "@/lib/fumero/max-goal-shared";

const MAX_GOALS_CHARS = 1500;

function formatGoalsList(goals: string): string {
  const lines = goals
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  return lines.map((l) => (l.startsWith("-") ? l : `- ${l}`)).join("\n");
}

export function applyGoalCommand(
  klant: string,
  cmd: ParsedGoalCommand
): { goals: string | null; reply: string } {
  const existing = getMotorUserContext(klant);

  if (cmd.action === "show") {
    const g = existing?.goals?.trim();
    return {
      goals: g ?? null,
      reply: g
        ? `**Jouw doel (onthouden):**\n\n${g}\n\n_Wijzig met \`/goal nieuwe tekst\`, voeg toe met \`/goal add …\`, wis met \`/goal clear\`._`
        : "Er staat nog geen doel vast. Typ bijvoorbeeld:\n\n`/goal Chatbot op fumero.nl die FAQ en shop beantwoordt`",
    };
  }

  if (cmd.action === "clear") {
    upsertMotorUserContext(klant, { goals: null });
    return {
      goals: null,
      reply: "Doel gewist. Je kunt altijd een nieuw doel zetten met `/goal …`.",
    };
  }

  if (cmd.action === "add") {
    const prev = existing?.goals?.trim() ?? "";
    const next = formatGoalsList(
      prev ? `${prev}\n- ${cmd.text}` : `- ${cmd.text}`
    ).slice(0, MAX_GOALS_CHARS);
    upsertMotorUserContext(klant, { goals: next });
    return {
      goals: next,
      reply: `Doel bijgewerkt:\n\n${next}`,
    };
  }

  const next = cmd.text.trim().slice(0, MAX_GOALS_CHARS);
  upsertMotorUserContext(klant, { goals: next });
  return {
    goals: next,
    reply: `**Doel opgeslagen** — ik houd dit aan in Bouwen en chat:\n\n${next}`,
  };
}

export function formatMaxLongTermGoalBlock(ctx: MotorUserContext | null): string {
  const goals = ctx?.goals?.trim();
  return [
    "### Langdurig denken (doel van de gebruiker)",
    goals
      ? `Huidig doel (onthouden over sessies heen):\n${goals}`
      : "Nog geen vast doel — als de gebruiker `/goal …` typt of een richting noemt, koppel daarop aan.",
    "Denk aan volgende stappen: wat past bij dit doel, wat ontbreekt nog, wat kan later.",
    "Als cruciale info ontbreekt (welke pagina, voor wie, welk gedrag): stel eerst 1–3 korte vragen — bouw of scrape niet blind.",
    "Na antwoorden: bevestig kort het doel en ga pas dan bouwen of antwoorden met LIVE PAGINA-data.",
  ].join("\n");
}
