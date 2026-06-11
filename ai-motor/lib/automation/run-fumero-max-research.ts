import db from "@/lib/db/database";
import { callFactoryN8n, extractMessage } from "@/lib/chat-n8n";
import { ensureFumeroSchema } from "@/lib/fumero/db-migrate";
import { isOpenRouterDirectConfigured, completeOpenRouterChat } from "@/lib/openrouter-gateway";

export async function runFumeroMaxResearch(): Promise<{
  ok: boolean;
  detail: string;
}> {
  ensureFumeroSchema();

  const posts = db
    .prepare(
      `SELECT platform, content FROM content_posts
       WHERE klant = 'fumero' ORDER BY id DESC LIMIT 6`
    )
    .all() as Array<{ platform: string; content: string }>;

  const prompt = `Nachtresearch voor fumero.nl (HHC/wellness webshop).
Geef JSON: {"seo_opportunities":["..."],"social_ideas":["..."],"risks":["..."]}
Recente posts: ${JSON.stringify(posts.map((p) => ({ p: p.platform, t: p.content.slice(0, 80) })))}`;

  try {
    let raw: string;
    if (isOpenRouterDirectConfigured()) {
      const { message } = await completeOpenRouterChat({
        messages: [
          {
            role: "system",
            content: "Je bent Smokey research agent voor Fumero. Alleen JSON.",
          },
          { role: "user", content: prompt },
        ],
        maxTokens: 1200,
      });
      raw = message;
    } else {
      const n8n = await callFactoryN8n({
        prompt,
        klant: "fumero",
        afdeling: "marketing",
        type: "max_research",
      });
      if (!n8n.ok) {
        return { ok: false, detail: `Research n8n: ${n8n.status}` };
      }
      raw = extractMessage(n8n.data);
    }

    db.prepare(
      `INSERT INTO fumero_briefings (summary, actions_json, opportunities_json, status_json, context_json)
       VALUES (?, '[]', ?, '[]', ?)`
    ).run(
      "Smokey nachtresearch",
      JSON.stringify([raw.slice(0, 2000)]),
      JSON.stringify({ kind: "max_research", raw: raw.slice(0, 8000) })
    );

    return { ok: true, detail: `Research opgeslagen (${raw.length} tekens).` };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : "Smokey research mislukt",
    };
  }
}
