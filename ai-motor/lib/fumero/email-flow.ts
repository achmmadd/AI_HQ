import db from "@/lib/db/database";
import { callFactoryN8n, extractMessage } from "@/lib/chat-n8n";
import {
  completeOpenRouterChat,
  isOpenRouterDirectConfigured,
} from "@/lib/openrouter-gateway";

export type EmailFlowDraft = {
  title: string;
  trigger: string;
  tone: string;
  steps: Array<{ step: number; timing: string; subject: string; goal: string }>;
};

async function generateDraftWithLlm(prompt: string): Promise<EmailFlowDraft> {
  const system = `Je bent een e-mail automation architect voor fumero.nl (WooCommerce).
Ontwerp een flow in het Nederlands. Antwoord ALLEEN JSON:
{"title":"...","trigger":"...","tone":"...","steps":[{"step":1,"timing":"...","subject":"...","goal":"..."}]}`;

  if (isOpenRouterDirectConfigured()) {
    const { message } = await completeOpenRouterChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      maxTokens: 1500,
    });
    const parsed = JSON.parse(message) as EmailFlowDraft;
    return parsed;
  }

  const n8n = await callFactoryN8n({
    prompt: `${system}\n\nFlow request: ${prompt}`,
    klant: "fumero",
    afdeling: "email",
    type: "email_flow_design",
  });
  if (!n8n.ok) throw new Error(`Flow LLM: HTTP ${n8n.status}`);
  return JSON.parse(extractMessage(n8n.data)) as EmailFlowDraft;
}

export async function buildFumeroEmailFlow(prompt: string): Promise<{
  draft: EmailFlowDraft;
  flow_id: number;
  n8n_status: string;
}> {
  const draft = await generateDraftWithLlm(prompt);

  const ins = db
    .prepare(
      `INSERT INTO fumero_email_flows (title, trigger_text, tone, steps_json, source_prompt, status)
       VALUES (?, ?, ?, ?, ?, 'draft')`
    )
    .run(
      draft.title,
      draft.trigger,
      draft.tone,
      JSON.stringify(draft.steps),
      prompt
    );

  const flowId = Number(ins.lastInsertRowid);
  return { draft, flow_id: flowId, n8n_status: "draft" };
}

export async function activateFumeroEmailFlow(flowId: number): Promise<{
  ok: boolean;
  status: string;
  n8n_status: string;
}> {
  const row = db
    .prepare(
      `SELECT id, title, trigger_text, tone, steps_json, source_prompt, status
       FROM fumero_email_flows WHERE id = ?`
    )
    .get(flowId) as
    | {
        id: number;
        title: string;
        trigger_text: string;
        tone: string;
        steps_json: string;
        source_prompt: string;
        status: string;
      }
    | undefined;

  if (!row) {
    throw new Error("Flow niet gevonden");
  }

  if (row.status === "live") {
    return { ok: true, status: "live", n8n_status: "already_live" };
  }

  const steps = JSON.parse(row.steps_json || "[]") as EmailFlowDraft["steps"];
  const draft: EmailFlowDraft = {
    title: row.title,
    trigger: row.trigger_text,
    tone: row.tone,
    steps,
  };

  const webhook =
    process.env.N8N_FUMERO_EMAIL_FLOW_WEBHOOK?.trim() ||
    process.env.N8N_FACTORY_OS_WEBHOOK?.trim();

  let n8nStatus = "not_configured";
  if (webhook) {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "fumero-studio",
        type: "email_flow_activate",
        klant: "fumero",
        flow_id: flowId,
        prompt: row.source_prompt,
        draft,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    n8nStatus = res.ok ? "ok" : `http_${res.status}`;
    if (!res.ok) {
      throw new Error(`n8n webhook mislukt (${res.status})`);
    }
  } else {
    n8nStatus = "no_webhook_simulated";
  }

  db.prepare(
    `UPDATE fumero_email_flows SET status = 'live', updated_at = datetime('now') WHERE id = ?`
  ).run(flowId);

  return { ok: true, status: "live", n8n_status: n8nStatus };
}
