import { shouldRunChatWebResearch } from "@/lib/chat-web-research";
import type { FumeroBriefingPayload } from "@/lib/fumero/briefing";
import { formatMaxBriefingSystemBlock } from "@/lib/fumero/max-briefing-chat";
import type { ConnectorId } from "@/lib/connectors/registry";
import { connectorsToFetch } from "@/lib/connectors/relevance";
import {
  FUMERO_DESIGN_SYSTEM_BLOCK,
  formatTemplatesConnectorBlock,
} from "@/lib/connectors/specialists";
import { buildScrapeContextForPrompt } from "@/lib/scrape/build-scrape-context";
import { resolveScrapePageLimit } from "@/lib/scrape/resolve-scrape-targets";

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

export type FumeroAugmentedPrompt = {
  prompt: string;
  scrapeUrls: string[];
};

/**
 * Bouwt API-prompt met live connector-context. UI toont alleen `userPrompt`.
 */
export async function augmentPromptWithFumeroConnectors(
  userPrompt: string,
  enabled: ConnectorId[],
  opts?: {
    onlineMode?: boolean;
    buildIntent?: boolean;
    onProgress?: (label: string) => void;
  }
): Promise<FumeroAugmentedPrompt> {
  let prompt = userPrompt.trim();
  if (!prompt) return { prompt, scrapeUrls: [] };

  const report = opts?.onProgress;
  const toFetch = connectorsToFetch(enabled, prompt, opts);
  const blocks: string[] = [];

  const connectorIds = toFetch.filter((id) => id !== "online_research");
  if (connectorIds.length) {
    report?.(
      connectorIds.length === 1
        ? `Connector: ${connectorIds[0]}…`
        : `Connectors laden (${connectorIds.length})…`
    );
  }

  await Promise.all(
    connectorIds.map(async (id) => {
      const block = await fetchConnectorBlock(id);
      if (block) blocks.push(block);
    })
  );

  if (connectorIds.length && blocks.length) {
    report?.("Connector-data geladen…");
  }

  const onlineActive =
    opts?.onlineMode ||
    (enabled.includes("online_research") &&
      connectorsToFetch(["online_research"], prompt, opts).length > 0);

  if (onlineActive && !shouldRunChatWebResearch(prompt)) {
    prompt = `Zoek op het web naar ${prompt}`;
  }

  const scrapeResult = await buildScrapeContextForPrompt(userPrompt, "fumero", {
    maxPages: resolveScrapePageLimit(userPrompt, {
      buildIntent: opts?.buildIntent,
    }),
    maxTotalChars: opts?.buildIntent ? 28_000 : 24_000,
    reason: opts?.buildIntent ? "bouwen chat context" : "max chat context",
    onProgress: report,
  });
  const scrapeUrls = scrapeResult?.urls ?? [];
  if (scrapeResult?.block) {
    prompt = [scrapeResult.block, prompt].join("\n");
  }

  if (blocks.length === 0) {
    return { prompt, scrapeUrls };
  }

  return {
    prompt: [CONTEXT_HEADER, ...blocks, CONTEXT_FOOTER, "", prompt].join("\n"),
    scrapeUrls,
  };
}

export function formatFumeroScrapeChatNotice(urls: string[]): string | null {
  if (!urls.length) return null;
  if (urls.length === 1) {
    try {
      const u = new URL(urls[0]);
      const path = u.pathname.replace(/\/$/, "") || "/";
      const where =
        path === "/" ? u.hostname : `${u.hostname}${path}`;
      return `Ik las **${where}** voor je — even samenvatten.`;
    } catch {
      return `Ik las **${urls[0]}** voor je — even samenvatten.`;
    }
  }
  return `Ik las **${urls.length} pagina's** op fumero.nl voor je — even samenvatten.`;
}
