import { buildFumeroBriefing } from "@/lib/fumero/briefing";
import {
  buildCommandCenterTodos,
  formatCommandCenterDigest,
} from "@/lib/fumero/command-center-todos";
import { ensureFumeroSchema } from "@/lib/fumero/db-migrate";
import { notifyFumeroCommandCenterDigest } from "@/lib/telegram";

export async function runFumeroMaxBriefing(): Promise<{
  ok: boolean;
  detail: string;
}> {
  ensureFumeroSchema();
  try {
    const b = await buildFumeroBriefing({ persist: true });
    const todos = buildCommandCenterTodos("fumero");
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      "http://127.0.0.1:3040";
    const digest = formatCommandCenterDigest(todos, baseUrl);
    void notifyFumeroCommandCenterDigest(
      `☀️ Smokey briefing Fumero\n${b.summary.slice(0, 280)}\n\n${digest}`
    );
    return { ok: true, detail: `Briefing opgeslagen: ${b.actions.length} acties.` };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : "Smokey briefing mislukt",
    };
  }
}
