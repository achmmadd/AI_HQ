import {
  getResearchFromCache,
  hashResearchKey,
  setResearchCache,
  type CachedResearchRow,
} from "@/lib/builder-research-cache";

export type DesignResearch = {
  sources: string[];
  patterns: string[];
  colors: string[];
  analysis: string;
  /** Tekst om toe te voegen aan de Dify-buildprompt */
  promptSuffix: string;
};

const URL_RE = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

export function extractUrlsFromText(text: string): string[] {
  const m = text.match(URL_RE);
  if (!m) return [];
  return [...new Set(m.map((u) => u.replace(/[),.]+$/g, "")))];
}

async function fetchOgImageUrl(pageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      headers: { "User-Agent": "MotorAI-Builder/1.0 (+research)" },
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("image/")) return pageUrl;
    const html = await res.text();
    const meta =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
      ) ??
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
      );
    const url = meta?.[1]?.trim();
    if (!url) return null;
    if (url.startsWith("//")) return `https:${url}`;
    if (url.startsWith("/")) {
      try {
        return new URL(url, pageUrl).toString();
      } catch {
        return null;
      }
    }
    return url;
  } catch {
    return null;
  }
}

async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: { "User-Agent": "MotorAI-Builder/1.0 (+vision)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0];
    if (!ct.toLowerCase().startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 4 * 1024 * 1024) return null;
    return Buffer.from(buf).toString("base64");
  } catch {
    return null;
  }
}

function visionUrlScanLimit(): number {
  const raw = process.env.MOTOR_BUILDER_VISION_PAGES?.trim();
  if (!raw) return 2;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return 2;
  return Math.max(0, Math.min(3, n));
}

async function visionFromPageUrl(
  pageUrl: string
): Promise<Record<string, unknown> | null> {
  const img = await fetchOgImageUrl(pageUrl);
  if (!img) return null;
  const b64 = await fetchImageAsBase64(img);
  if (!b64) return null;
  const mt = img.toLowerCase().endsWith(".png")
    ? "image/png"
    : img.toLowerCase().endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";
  return runVisionOnImage(mt, b64);
}

async function anthropicMessagesJson(body: unknown, beta?: string): Promise<{
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return { ok: false, status: 0, data: {} };
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
  if (beta) headers["anthropic-beta"] = beta;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return { ok: res.ok, status: res.status, data };
}

function blocksText(data: Record<string, unknown>): string {
  const content = data.content as unknown;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content as { type?: string; text?: string }[]) {
    if (block?.type === "text" && typeof block.text === "string") {
      parts.push(block.text);
    }
  }
  return parts.join("\n");
}

function parseResearchJson(
  raw: string
): Omit<DesignResearch, "promptSuffix"> | null {
  const t = raw.trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const j = JSON.parse(t.slice(start, end + 1)) as {
      sources?: unknown;
      patterns?: unknown;
      colors?: unknown;
      analysis?: unknown;
    };
    const sources = Array.isArray(j.sources)
      ? j.sources.filter((x): x is string => typeof x === "string")
      : [];
    const patterns = Array.isArray(j.patterns)
      ? j.patterns.filter((x): x is string => typeof x === "string")
      : [];
    const colors = Array.isArray(j.colors)
      ? j.colors.filter((x): x is string => typeof x === "string")
      : [];
    const analysis = typeof j.analysis === "string" ? j.analysis : "";
    return { sources, patterns, colors, analysis };
  } catch {
    return null;
  }
}

async function runWebResearch(
  request: string,
  includeLinks: string[]
): Promise<string> {
  const linkBlock =
    includeLinks.length > 0
      ? `\nUser-supplied links to consider: ${includeLinks.join(", ")}`
      : "";
  const userLine = `Design research task: ${request}${linkBlock}

Use web search to find current, concrete examples relevant to this UI request.
Then respond with ONLY a raw JSON object (no markdown fences) with keys:
sources (string array of URLs you found),
patterns (short UI pattern labels),
colors (hex codes when visible, else descriptive color names),
analysis (one paragraph summarizing layout, typography, and interaction ideas for a single vanilla-HTML mini-app).`;

  const withTools = await anthropicMessagesJson(
    {
      model:
        process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514",
      max_tokens: 4096,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 2,
        },
      ],
      messages: [{ role: "user", content: userLine }],
    },
    "web-search-2025-03-05"
  );

  if (withTools.ok) return blocksText(withTools.data);

  const plain = await anthropicMessagesJson({
    model:
      process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `${userLine}\n(No web search available — rely on best practices for modern product sites.)`,
      },
    ],
  });
  if (plain.ok) return blocksText(plain.data);
  return "";
}

async function runVisionOnImage(
  mediaType: string,
  base64: string
): Promise<Record<string, unknown> | null> {
  const { ok, data } = await anthropicMessagesJson({
    model:
      process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: "text",
            text: `Extract a JSON object only (no markdown) with keys:
colors (string[] hex or names), layout (short string), components (string[]), style (short string), interactions (short string).`,
          },
        ],
      },
    ],
  });
  if (!ok) return null;
  const t = blocksText(data).trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function toPromptSuffix(d: Omit<DesignResearch, "promptSuffix">): string {
  const lines = [
    "### Design research (auto)",
    d.analysis ? d.analysis : "(geen samenvatting)",
    d.patterns.length ? `Patronen: ${d.patterns.join(", ")}` : "",
    d.colors.length ? `Kleuren: ${d.colors.join(", ")}` : "",
    d.sources.length ? `Bronnen: ${d.sources.slice(0, 8).join(", ")}` : "",
  ].filter(Boolean);
  return `\n\n${lines.join("\n")}\n`;
}

function rowToDesign(row: CachedResearchRow): DesignResearch {
  const parseArr = (s: string) => {
    try {
      const j = JSON.parse(s) as unknown;
      return Array.isArray(j) ? j.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  };
  const patternsObj = JSON.parse(row.patterns || "{}") as {
    patterns?: string[];
    colors?: string[];
    sources?: string[];
  };
  const sources = patternsObj.sources ?? parseArr(row.search_results);
  const patterns = patternsObj.patterns ?? [];
  const colors = patternsObj.colors ?? [];
  const vision = JSON.parse(row.vision_analysis || "{}") as Record<
    string,
    unknown
  >;
  if (typeof vision.colors === "object" && Array.isArray(vision.colors)) {
    for (const c of vision.colors as unknown[]) {
      if (typeof c === "string" && !colors.includes(c)) colors.push(c);
    }
  }
  const analysis = row.analysis || "";
  const base = { sources, patterns, colors, analysis };
  return { ...base, promptSuffix: toPromptSuffix(base) };
}

export async function researchDesignPatterns(opts: {
  request: string;
  includeLinks?: string[];
  klant?: string;
}): Promise<DesignResearch> {
  const request = opts.request.trim();
  const includeLinks = [...(opts.includeLinks ?? [])].filter(Boolean);
  const empty: DesignResearch = {
    sources: [],
    patterns: [],
    colors: [],
    analysis: "",
    promptSuffix: "",
  };

  if (!process.env.ANTHROPIC_API_KEY?.trim()) return empty;

  const queryHash = hashResearchKey(request, includeLinks);
  const cached = getResearchFromCache(queryHash);
  if (cached) return rowToDesign(cached);

  try {
    const rawText = await runWebResearch(request, includeLinks);
    const parsed =
      parseResearchJson(rawText) ??
      ({
        sources: extractUrlsFromText(rawText),
        patterns: [],
        colors: [],
        analysis: rawText.slice(0, 2000),
      } as Omit<DesignResearch, "promptSuffix">);

    const urlSet = new Set<string>([
      ...parsed.sources,
      ...includeLinks,
      ...extractUrlsFromText(request),
    ]);
    const urls = [...urlSet].slice(0, visionUrlScanLimit());
    const visionParts =
      urls.length > 0
        ? (
            await Promise.all(urls.map((pageUrl) => visionFromPageUrl(pageUrl)))
          ).filter(
            (v): v is Record<string, unknown> =>
              v !== null && typeof v === "object"
          )
        : [];
    for (const v of visionParts) {
      const vc = v.colors;
      if (Array.isArray(vc)) {
        for (const c of vc) {
          if (typeof c === "string" && !parsed.colors.includes(c))
            parsed.colors.push(c);
        }
      }
      if (typeof v.layout === "string" && v.layout && !parsed.analysis)
        parsed.analysis = v.layout as string;
    }

    const patternsPayload = JSON.stringify({
      patterns: parsed.patterns,
      colors: parsed.colors,
      sources: parsed.sources,
    });

    setResearchCache(queryHash, {
      search_results: JSON.stringify(parsed.sources),
      vision_analysis: JSON.stringify(
        visionParts.length ? { pages: visionParts } : {}
      ),
      patterns: patternsPayload,
      analysis: parsed.analysis,
    });

    return { ...parsed, promptSuffix: toPromptSuffix(parsed) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[builder-research] researchDesignPatterns failed:", msg);
    return empty;
  }
}
