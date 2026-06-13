import { callFactoryN8n, extractMessage } from "@/lib/chat-n8n";
import {
  completeOpenRouterChat,
  isOpenRouterDirectConfigured,
} from "@/lib/openrouter-gateway";

export type CampaignLlmResult<T> =
  | { ok: true; data: T; source: "openrouter" | "n8n" }
  | { ok: false; error: string };

/** Max wait for campaign LLM calls — keeps wizard responsive (default 30s, cap 30s). */
export function campaignLlmTimeoutMs(): number {
  const raw = process.env.CAMPAIGN_LLM_TIMEOUT_MS?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 30_000;
  if (!Number.isFinite(n) || n < 3_000) return 30_000;
  return Math.min(n, 30_000);
}

/** Optional faster OpenRouter model for campaign JSON (e.g. google/gemini-2.5-flash). */
export function campaignLlmModel(): string | undefined {
  const model = process.env.CAMPAIGN_LLM_MODEL?.trim();
  return model || undefined;
}

function stripJsonFence(raw: string): string {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  return (fenced?.[1] ?? trimmed).trim();
}

export function isCampaignTemplateOnly(): boolean {
  /** Production always uses LLM first; templates are timeout/parse fallbacks only. */
  if (process.env.NODE_ENV === "production") return false;
  if (process.env.CAMPAIGN_TEMPLATE_ONLY === "1") return true;
  if (process.env.CAMPAIGN_TEMPLATE_ONLY === "0") return false;
  return process.env.NODE_ENV === "development";
}

export async function callCampaignLlmJson<T>(opts: {
  system: string;
  user: string;
  n8nType: string;
  klant?: string;
  maxTokens?: number;
}): Promise<CampaignLlmResult<T>> {
  const { system, user, n8nType, klant = "fumero", maxTokens = 2000 } = opts;
  const timeoutMs = campaignLlmTimeoutMs();

  if (isCampaignTemplateOnly()) {
    return { ok: false, error: "CAMPAIGN_TEMPLATE_ONLY=1" };
  }

  if (isOpenRouterDirectConfigured()) {
    try {
      const { message } = await completeOpenRouterChat({
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        model: campaignLlmModel(),
        maxTokens,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const parsed = JSON.parse(stripJsonFence(message)) as T;
      return { ok: true, data: parsed, source: "openrouter" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `OpenRouter: ${msg}` };
    }
  }

  const n8n = await callFactoryN8n(
    {
      prompt: `${system}\n\n${user}`,
      klant,
      afdeling: "marketing",
      type: n8nType,
    },
    { timeoutMs }
  );

  if (!n8n.ok) {
    const detail = n8n.fetchError?.trim() || `status ${n8n.status}`;
    return { ok: false, error: `n8n mislukt: ${detail}` };
  }

  try {
    const raw = extractMessage(n8n.data);
    const parsed = JSON.parse(stripJsonFence(raw)) as T;
    return { ok: true, data: parsed, source: "n8n" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `n8n JSON parse: ${msg}` };
  }
}
