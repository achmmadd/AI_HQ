import { searchKnowledge, payloadText } from "@/lib/knowledge-search";
import { callDifyBlocking } from "@/lib/dify-client";
import { sendTelegramMessage } from "@/lib/telegram";

export async function runSocialScheduleWeekly(): Promise<{
  ok: boolean;
  detail: string;
}> {
  const kbQuery =
    process.env.SOCIAL_KB_QUERY?.trim() ||
    "Fumero producten merken en tone of voice voor social media";

  const { results, error } = await searchKnowledge(kbQuery, {
    klant: "fumero",
    limit: 14,
  });

  if (error) {
    return { ok: false, detail: `Kennisbank / Qdrant: ${error}` };
  }

  if (results.length === 0) {
    return {
      ok: false,
      detail: "Geen kennisbank-resultaten; vul Qdrant of pas SOCIAL_KB_QUERY aan.",
    };
  }

  const context = results
    .map((h, i) => `[${i + 1}] ${payloadText(h)}`)
    .join("\n\n")
    .slice(0, 14_000);

  const dify = await callDifyBlocking({
    query: `Op basis van onderstaande interne kennis (alleen deze feiten gebruiken), schrijf 3 social posts in het Nederlands: mix Instagram en TikTok-stijl, kort en concreet. Geen medische claims. Sluit af met een regel "---" en dan 5 hashtag-suggesties per post.\n\nBRONNEN:\n${context}`,
    inputs: {
      klant: process.env.SOCIAL_DIFY_KLANT?.trim() || "fumero",
      afdeling: "marketing",
    },
    user: "social-weekly",
  });

  if (!dify.ok) {
    return { ok: false, detail: `Dify: ${dify.answer || dify.raw || "error"}` };
  }

  const webhook =
    process.env.N8N_SOCIAL_SCHEDULER_WEBHOOK?.trim() ||
    process.env.N8N_SOCIAL_WEBHOOK?.trim();
  if (!webhook) {
    return {
      ok: false,
      detail:
        "N8N_SOCIAL_SCHEDULER_WEBHOOK ontbreekt (POST naar /social-scheduler workflow).",
    };
  }

  const res = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: "motorsai-automation",
      task_key: "social_schedule_weekly",
      content: dify.answer,
      klant: "fumero",
      kb_hits: results.length,
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    return {
      ok: false,
      detail: `n8n webhook HTTP ${res.status}: ${t.slice(0, 400)}`,
    };
  }

  void sendTelegramMessage(
    `📱 Social weekplan naar n8n gestuurd (${results.length} KB-chunks)`
  );

  return {
    ok: true,
    detail: `Social: Dify-output (${dify.answer.length} tekens) naar n8n gepost.`,
  };
}
