import db from "@/lib/db/database";
import {
  completeOpenRouterChat,
  isOpenRouterDirectConfigured,
} from "@/lib/openrouter-gateway";
import { callFactoryN8n, extractMessage } from "@/lib/chat-n8n";

export type FumeroBriefingPayload = {
  generated_at: string;
  agent: string;
  summary: string;
  actions: string[];
  opportunities: string[];
  status: string[];
  latest_posts: Array<{
    id: number;
    platform: string;
    status: string;
    content: string;
    created_at: string;
  }>;
  automation_tasks: unknown[];
};

function gatherContext() {
  const latestPosts = db
    .prepare(
      `SELECT id, platform, status, content, created_at
       FROM content_posts WHERE klant = 'fumero'
       ORDER BY datetime(created_at) DESC LIMIT 8`
    )
    .all() as FumeroBriefingPayload["latest_posts"];

  const postStats = db
    .prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as drafts,
         SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
         SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published
       FROM content_posts WHERE klant = 'fumero'`
    )
    .get() as {
    total: number;
    drafts: number;
    scheduled: number;
    published: number;
  };

  const ordersToday = db
    .prepare(
      `SELECT COUNT(*) as c, COALESCE(SUM(total_cents), 0) as cents
       FROM fumero_orders
       WHERE date(order_date) = date('now', 'localtime')`
    )
    .get() as { c: number; cents: number };

  const failedRuns = db
    .prepare(
      `SELECT COUNT(*) as c FROM automation_runs r
       JOIN automation_tasks t ON t.id = r.task_id
       WHERE r.status = 'failed'
         AND datetime(r.created_at) > datetime('now', '-7 days')
         AND (
           t.task_key LIKE 'fumero%'
           OR t.task_key IN (
             'send_invoice_emails',
             'social_schedule_weekly',
             'analytics_report_weekly'
           )
         )`
    )
    .get() as { c: number };

  const tasks = db
    .prepare(
      `SELECT task_key, title, enabled, schedule_kind, schedule_time
       FROM automation_tasks
       WHERE task_key IN (
         'fumero_orders_daily','fumero_max_briefing','fumero_max_research','fumero_kennisbank_refresh',
         'send_invoice_emails','social_schedule_weekly','analytics_report_weekly','vendor_check_weekly'
       )
       ORDER BY id ASC`
    )
    .all();

  const lastBriefing = db
    .prepare(
      `SELECT summary, actions_json, opportunities_json, created_at
       FROM fumero_briefings ORDER BY id DESC LIMIT 1`
    )
    .get() as
    | {
        summary: string;
        actions_json: string;
        opportunities_json: string;
        created_at: string;
      }
    | undefined;

  return {
    latestPosts,
    postStats,
    ordersToday,
    failedRuns,
    tasks,
    lastBriefing,
  };
}

async function generateWithLlm(contextBlock: string): Promise<{
  summary: string;
  actions: string[];
  opportunities: string[];
  status: string[];
}> {
  const system = `Je bent Max, AI-assistent voor Fumero (fumero.nl). Schrijf een ochtendbriefing in het Nederlands.
Antwoord ALLEEN met geldig JSON (geen markdown):
{"summary":"...","actions":["...","...","..."],"opportunities":["...","..."],"status":["...","..."]}
Acties = concreet vandaag. Kansen = groei/SEO/social. Status = feiten uit data.`;

  if (isOpenRouterDirectConfigured()) {
    const { message } = await completeOpenRouterChat({
      messages: [
        { role: "system", content: system },
        { role: "user", content: contextBlock },
      ],
      maxTokens: 1200,
    });
    try {
      const parsed = JSON.parse(message) as {
        summary?: string;
        actions?: string[];
        opportunities?: string[];
        status?: string[];
      };
      return {
        summary: String(parsed.summary || "").trim() || "Fumero briefing.",
        actions: Array.isArray(parsed.actions) ? parsed.actions.map(String).slice(0, 5) : [],
        opportunities: Array.isArray(parsed.opportunities)
          ? parsed.opportunities.map(String).slice(0, 4)
          : [],
        status: Array.isArray(parsed.status) ? parsed.status.map(String).slice(0, 4) : [],
      };
    } catch {
      return {
        summary: message.slice(0, 400),
        actions: [],
        opportunities: [],
        status: [],
      };
    }
  }

  const n8n = await callFactoryN8n({
    prompt: `${system}\n\nDATA:\n${contextBlock}`,
    klant: "fumero",
    afdeling: "marketing",
    type: "max_briefing",
  });
  if (!n8n.ok) {
    throw new Error(`Briefing LLM mislukt: ${n8n.status}`);
  }
  const raw = extractMessage(n8n.data);
  try {
    const parsed = JSON.parse(raw) as {
      summary?: string;
      actions?: string[];
      opportunities?: string[];
      status?: string[];
    };
    return {
      summary: String(parsed.summary || "").trim() || "Fumero briefing.",
      actions: Array.isArray(parsed.actions) ? parsed.actions.map(String) : [],
      opportunities: Array.isArray(parsed.opportunities)
        ? parsed.opportunities.map(String)
        : [],
      status: Array.isArray(parsed.status) ? parsed.status.map(String) : [],
    };
  } catch {
    return {
      summary: raw.slice(0, 500),
      actions: [],
      opportunities: [],
      status: [],
    };
  }
}

export async function buildFumeroBriefing(opts?: {
  persist?: boolean;
}): Promise<FumeroBriefingPayload> {
  const ctx = gatherContext();
  const contextBlock = JSON.stringify(
    {
      posts: ctx.postStats,
      orders_today: ctx.ordersToday,
      failed_automation_runs_7d: ctx.failedRuns.c,
      latest_posts: ctx.latestPosts.map((p) => ({
        platform: p.platform,
        status: p.status,
        preview: p.content.slice(0, 120),
      })),
      automation_tasks: ctx.tasks,
      previous_briefing: ctx.lastBriefing?.summary ?? null,
    },
    null,
    2
  );

  let summary: string;
  let actions: string[];
  let opportunities: string[];
  let status: string[];

  try {
    const llm = await generateWithLlm(contextBlock);
    summary = llm.summary;
    actions = llm.actions.length
      ? llm.actions
      : [
          "Keur openstaande content drafts goed.",
          "Controleer geplande social posts voor vandaag.",
        ];
    opportunities = llm.opportunities;
    status =
      llm.status.length > 0
        ? llm.status
        : [
            `${ctx.postStats.drafts ?? 0} drafts · ${ctx.postStats.scheduled ?? 0} ingepland`,
            `${ctx.ordersToday.c ?? 0} orders vandaag (€${((ctx.ordersToday.cents ?? 0) / 100).toFixed(0)})`,
          ];
  } catch {
    summary = "Operationele Fumero briefing (gebaseerd op live database).";
    actions = [
      "Controleer content drafts en plan publicatie via Studio.",
      "Run order-sync als WooCommerce-dashboard afwijkt.",
    ];
    opportunities = [
      "Publiceer 1 SEO-artikel rond HHC koopintentie.",
      "Plan 2 social posts via ingeplande content.",
    ];
    status = [
      `Posts: ${ctx.postStats.total ?? 0} totaal, ${ctx.postStats.drafts ?? 0} drafts`,
      `Orders vandaag: ${ctx.ordersToday.c ?? 0}`,
    ];
  }

  const generated_at = new Date().toISOString();
  const payload: FumeroBriefingPayload = {
    generated_at,
    agent: "Max",
    summary,
    actions,
    opportunities,
    status,
    latest_posts: ctx.latestPosts,
    automation_tasks: ctx.tasks,
  };

  if (opts?.persist !== false) {
    db.prepare(
      `INSERT INTO fumero_briefings (summary, actions_json, opportunities_json, status_json, context_json)
       VALUES (?, ?, ?, ?, ?)`
    ).run(
      summary,
      JSON.stringify(actions),
      JSON.stringify(opportunities),
      JSON.stringify(status),
      contextBlock
    );
  }

  return payload;
}

export function getLatestFumeroBriefing(): FumeroBriefingPayload | null {
  const row = db
    .prepare(
      `SELECT summary, actions_json, opportunities_json, status_json, created_at
       FROM fumero_briefings ORDER BY id DESC LIMIT 1`
    )
    .get() as
    | {
        summary: string;
        actions_json: string;
        opportunities_json: string;
        status_json: string;
        created_at: string;
      }
    | undefined;
  if (!row) return null;

  const latestPosts = db
    .prepare(
      `SELECT id, platform, status, content, created_at
       FROM content_posts WHERE klant = 'fumero'
       ORDER BY datetime(created_at) DESC LIMIT 5`
    )
    .all() as FumeroBriefingPayload["latest_posts"];

  const tasks = db
    .prepare(
      `SELECT task_key, title, enabled, schedule_kind, schedule_time
       FROM automation_tasks
       WHERE task_key LIKE 'fumero%' OR task_key IN ('send_invoice_emails','social_schedule_weekly')
       ORDER BY id ASC`
    )
    .all();

  return {
    generated_at: row.created_at,
    agent: "Max",
    summary: row.summary,
    actions: JSON.parse(row.actions_json || "[]") as string[],
    opportunities: JSON.parse(row.opportunities_json || "[]") as string[],
    status: JSON.parse(row.status_json || "[]") as string[],
    latest_posts: latestPosts,
    automation_tasks: tasks,
  };
}
