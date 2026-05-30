import db from "@/lib/db/database";
import { ensureWorkLinksSchema } from "@/lib/db/work-links-schema";

ensureWorkLinksSchema();

export type MotorUserContext = {
  klant: string;
  display_name: string | null;
  goals: string | null;
  preferences: string | null;
  updated_at: string;
};

export function getMotorUserContext(klant: string): MotorUserContext | null {
  const row = db
    .prepare(
      `SELECT klant, display_name, goals, preferences, updated_at
       FROM motor_user_context WHERE klant = ?`
    )
    .get(klant) as MotorUserContext | undefined;
  return row ?? null;
}

export function upsertMotorUserContext(
  klant: string,
  patch: Partial<Pick<MotorUserContext, "display_name" | "goals" | "preferences">>
): void {
  const existing = getMotorUserContext(klant);
  if (!existing) {
    db.prepare(
      `INSERT INTO motor_user_context (klant, display_name, goals, preferences)
       VALUES (?, ?, ?, ?)`
    ).run(
      klant,
      patch.display_name ?? null,
      patch.goals ?? null,
      patch.preferences ?? null
    );
    return;
  }
  db.prepare(
    `UPDATE motor_user_context SET
       display_name = COALESCE(?, display_name),
       goals = COALESCE(?, goals),
       preferences = COALESCE(?, preferences),
       updated_at = datetime('now')
     WHERE klant = ?`
  ).run(
    patch.display_name ?? null,
    patch.goals ?? null,
    patch.preferences ?? null,
    klant
  );
}

export function formatUserContextBlock(klant: string): string {
  const ctx = getMotorUserContext(klant);
  if (!ctx) return "(nog geen profiel — MotorsAI leert van gesprekken en projecten)";
  const parts: string[] = [];
  if (ctx.display_name?.trim()) parts.push(`Naam/context: ${ctx.display_name.trim()}`);
  if (ctx.goals?.trim()) parts.push(`Doelen: ${ctx.goals.trim()}`);
  if (ctx.preferences?.trim()) parts.push(`Voorkeuren: ${ctx.preferences.trim()}`);
  if (!parts.length) return "(profiel leeg)";
  return parts.join("\n");
}

/** Heuristiek: eerste zinnen met “ik wil / mijn doel” uit prompt vastleggen. */
export function maybeLearnFromPrompt(klant: string, prompt: string): void {
  const t = prompt.trim();
  if (t.length < 20) return;
  const goalMatch = t.match(
    /\b(ik wil|mijn doel|we willen|focus op|belangrijk voor mij)\b[^.!?]{10,120}/i
  );
  if (goalMatch) {
    const existing = getMotorUserContext(klant);
    if (!existing?.goals?.includes(goalMatch[0].slice(0, 40))) {
      const goals = existing?.goals
        ? `${existing.goals}\n- ${goalMatch[0].trim().slice(0, 200)}`
        : goalMatch[0].trim().slice(0, 400);
      upsertMotorUserContext(klant, { goals: goals.slice(0, 1500) });
    }
  }
}
