import { buildFumeroBriefing } from "@/lib/fumero/briefing";
import { ensureFumeroSchema } from "@/lib/fumero/db-migrate";
import { sendTelegramMessage } from "@/lib/telegram";

export async function runFumeroMaxBriefing(): Promise<{
  ok: boolean;
  detail: string;
}> {
  ensureFumeroSchema();
  try {
    const b = await buildFumeroBriefing({ persist: true });
    void sendTelegramMessage(
      `☀️ Max briefing Fumero\n${b.summary.slice(0, 280)}`
    );
    return { ok: true, detail: `Briefing opgeslagen: ${b.actions.length} acties.` };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : "Max briefing mislukt",
    };
  }
}
