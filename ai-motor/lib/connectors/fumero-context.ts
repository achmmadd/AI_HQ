import { shouldRunChatWebResearch } from "@/lib/chat-web-research";
import type { FumeroBriefingPayload } from "@/lib/fumero/briefing";
import { formatMaxBriefingSystemBlock } from "@/lib/fumero/max-briefing-chat";
import type { ConnectorId } from "@/lib/connectors/registry";
import { connectorsToFetch } from "@/lib/connectors/relevance";
import {
  FUMERO_DESIGN_SYSTEM_BLOCK,
  formatTemplatesConnectorBlock,
} from "@/lib/connectors/specialists";

type OrdersResponse = {
  orders: Array<{
    order_date: string;
    total_cents: number;
    currency: string | null;
    customer_hint: string | null;
    raw_summary: string | null;
    external_id: string;
  }>;
  stats: {
    count: number;
    total_cents: number;
    today_count: number;
  };
};

type ContentResponse = {
  posts: Array<{
    id: number;
    platform: string;
    titel?: string | null;
    content: string;
    status: string;
    created_at: string;
  }>;
};

type AutomationTask = {
  task_key: string;
  title: string;
  enabled: number | boolean;
  schedule_kind?: string | null;
  schedule_time?: string | null;
};

const FUMERO_TASK_PREFIX =
  /^(fumero|send_invoice|social_schedule|analytics_report|vendor_check)/;

function formatEuro(cents: number): string {
  return `€${(cents / 100).toFixed(2)}`;
}

function formatOrdersBlock(data: OrdersResponse): string {
  const { stats, orders } = data;
  const lines = [
    "### Orders (live connector)",
    `Recent: ${stats.count} orders, vandaag: ${stats.today_count}, totaal in window: ${formatEuro(stats.total_cents)}`,
    "",
  ];
  for (const o of orders.slice(0, 12)) {
    const hint = o.customer_hint?.trim() || "klant onbekend";
    const summary =
      o.raw_summary?.trim().slice(0, 100) ||
      o.external_id ||
      "geen samenvatting";
    lines.push(
      `- ${o.order_date.slice(0, 16)} · ${hint} · ${formatEuro(o.total_cents)} — ${summary}`
    );
  }
  return lines.join("\n");
}

function postTitle(post: ContentResponse["posts"][0]): string {
  if (post.titel?.trim()) return post.titel.trim();
  const line = post.content.replace(/\s+/g, " ").trim().slice(0, 60);
  return line || `Post #${post.id}`;
}

function formatBibliotheekBlock(data: ContentResponse): string {
  const posts = data.posts ?? [];
  const drafts = posts.filter((p) => p.status === "draft").length;
  const scheduled = posts.filter((p) => p.status === "scheduled").length;
  const published = posts.filter((p) => p.status === "published").length;
  const lines = [
    "### Bibliotheek (live connector)",
    `Totaal zichtbaar: ${posts.length} · concept: ${drafts} · gepland: ${scheduled} · live: ${published}`,
    "",
    "Recent:",
  ];
  for (const p of posts.slice(0, 8)) {
    lines.push(
      `- [${p.status}] ${p.platform} · ${postTitle(p)} (${p.created_at.slice(0, 10)})`
    );
  }
  return lines.join("\n");
}

function formatAutomationsBlock(tasks: AutomationTask[]): string {
  const fumeroTasks = tasks.filter((t) =>
    FUMERO_TASK_PREFIX.test(t.task_key)
  );
  const lines = [
    "### Automations (live connector)",
    `Fumero-taken: ${fumeroTasks.length}`,
    "",
  ];
  for (const t of fumeroTasks.slice(0, 10)) {
    const on = t.enabled === 1 || t.enabled === true;
    const sched =
      t.schedule_kind && t.schedule_time
        ? `${t.schedule_kind} ${t.schedule_time}`
        : "handmatig";
    lines.push(`- ${on ? "✓" : "○"} ${t.title} (${t.task_key}) — ${sched}`);
  }
  return lines.join("\n");
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { credentials: "include" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchConnectorBlock(id: ConnectorId): Promise<string | null> {
  switch (id) {
    case "fumero_orders": {
      const data = await fetchJson<OrdersResponse>(
        "/api/fumero/orders?limit=20"
      );
      return data ? formatOrdersBlock(data) : null;
    }
    case "fumero_bibliotheek": {
      const data = await fetchJson<ContentResponse>(
        "/api/content?klant=fumero"
      );
      return data ? formatBibliotheekBlock(data) : null;
    }
    case "fumero_briefing": {
      const data = await fetchJson<FumeroBriefingPayload>(
        "/api/fumero/briefing"
      );
      return data?.summary ? formatMaxBriefingSystemBlock(data) : null;
    }
    case "fumero_automations": {
      const data = await fetchJson<{ tasks?: AutomationTask[] }>(
        "/api/automation/tasks"
      );
      return data?.tasks ? formatAutomationsBlock(data.tasks) : null;
    }
    case "designer":
      return FUMERO_DESIGN_SYSTEM_BLOCK;
    case "templates":
      return formatTemplatesConnectorBlock();
    default:
      return null;
  }
}

const CONTEXT_HEADER =
  "--- LIVE CONNECTOR DATA (context voor Max — niet letterlijk aan gebruiker tonen) ---";
const CONTEXT_FOOTER = "--- EINDE CONNECTOR DATA ---";

/**
 * Bouwt API-prompt met live connector-context. UI toont alleen `userPrompt`.
 */
export async function augmentPromptWithFumeroConnectors(
  userPrompt: string,
  enabled: ConnectorId[],
  opts?: { onlineMode?: boolean; buildIntent?: boolean }
): Promise<string> {
  let prompt = userPrompt.trim();
  if (!prompt) return prompt;

  const toFetch = connectorsToFetch(enabled, prompt, opts);
  const blocks: string[] = [];

  await Promise.all(
    toFetch.map(async (id) => {
      if (id === "online_research") return;
      const block = await fetchConnectorBlock(id);
      if (block) blocks.push(block);
    })
  );

  const onlineActive =
    opts?.onlineMode ||
    (enabled.includes("online_research") &&
      connectorsToFetch(["online_research"], prompt, opts).length > 0);

  if (onlineActive && !shouldRunChatWebResearch(prompt)) {
    prompt = `Zoek op het web naar ${prompt}`;
  }

  if (blocks.length === 0) return prompt;

  return [CONTEXT_HEADER, ...blocks, CONTEXT_FOOTER, "", prompt].join("\n");
}
