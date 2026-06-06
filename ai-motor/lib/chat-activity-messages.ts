import { shouldScrapeFromPrompt } from "@/lib/scrape/resolve-scrape-targets";

const URL_RE = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;

function hostFromUrl(url: string): string {
  try {
    return new URL(url.replace(/[),.]+$/g, "")).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 48);
  }
}

export function isFumeroKlant(klant: string): boolean {
  return klant.trim().toLowerCase() === "fumero";
}

export function chatAgentName(klant: string): "Max" | "Motor" {
  return isFumeroKlant(klant) ? "Max" : "Motor";
}

export function chatThinkingLabel(
  klant: string,
  opts?: { turbo?: boolean }
): string {
  if (opts?.turbo) return "Turbo denkt na…";
  const name = chatAgentName(klant);
  return `${name} denkt na…`;
}

/** Korte badge uit OpenRouter model-id (Flash / Sonnet). */
export function modelBadgeForId(modelId: string | undefined): string | null {
  if (!modelId?.trim()) return null;
  const m = modelId.toLowerCase();
  if (m.includes("flash")) return "Flash";
  if (m.includes("sonnet")) return "Sonnet";
  if (m.includes("haiku")) return "Haiku";
  if (m.includes("opus")) return "Opus";
  if (m.includes("deepseek")) return "DeepSeek";
  if (m.includes("sonar")) return "Sonar";
  return null;
}

export function extractUrlsFromPrompt(text: string): string[] {
  const m = text.match(URL_RE);
  if (!m) return [];
  return [...new Set(m.map((u) => u.replace(/[),.]+$/g, "")))];
}

/** Menselijke statusregels voor de chat-UI (geen “OpenClaw” naar de user). */
export function planMotorActivitySteps(opts: {
  klant?: string;
  prompt: string;
  agentMode: boolean;
  browserTask: boolean;
  useResearch: boolean;
  intent: "action" | "question" | "build";
  fumeroFast?: boolean;
}): string[] {
  const agent = chatAgentName(opts.klant ?? "motor");
  const urls = extractUrlsFromPrompt(opts.prompt);
  const steps: string[] = [];

  if (opts.agentMode) {
    steps.push("Turbo start…");
    if (opts.browserTask) {
      if (urls[0]) {
        steps.push(`Turbo bekijkt ${hostFromUrl(urls[0])}…`);
      } else {
        steps.push("Turbo gebruikt de browser…");
      }
    } else {
      steps.push("Turbo plant de stappen…");
    }
    return steps;
  }

  if (opts.fumeroFast) {
    if (shouldScrapeFromPrompt(opts.prompt, "fumero")) {
      steps.push("Site-check voorbereiden…");
      steps.push("Live pagina's ophalen…");
      steps.push(`${agent} formuleert antwoord…`);
    } else {
      steps.push("Opdracht verwerken…");
      steps.push(`${agent} · context laden…`);
      steps.push(`${agent} antwoordt…`);
    }
    return steps;
  }

  steps.push(`${agent} denkt na…`);

  if (opts.useResearch) {
    steps.push(`${agent} zoekt actuele info op het web…`);
    for (const u of urls.slice(0, 3)) {
      steps.push(`${agent} bekijkt ${hostFromUrl(u)}…`);
    }
    if (!urls.length) {
      steps.push(`${agent} vergelijkt bronnen…`);
    }
    return steps;
  }

  if (opts.intent === "build") {
    steps.push(`${agent} bereidt een build voor…`);
    return steps;
  }

  if (opts.intent === "action") {
    if (urls[0]) {
      steps.push(`${agent} bekijkt ${hostFromUrl(urls[0])}…`);
    } else {
      steps.push(`${agent} voert je opdracht uit…`);
    }
    return steps;
  }

  steps.push(`${agent} leest context…`);
  if (urls[0]) {
    steps.push(`${agent} bekijkt ${hostFromUrl(urls[0])}…`);
  }
  return steps;
}

export function motorRoutingLabel(
  routing: string | undefined,
  opts?: { klant?: string; modelBadge?: string | null }
): string {
  const agent = chatAgentName(opts?.klant ?? "motor");
  const badge =
    opts?.modelBadge && opts.modelBadge.trim()
      ? ` · ${opts.modelBadge.trim()}`
      : "";
  switch (routing) {
    case "openrouter":
      return `${agent} antwoordt…${badge}`;
    case "openclaw":
      return `${agent} antwoordt…`;
    case "local_executor":
      return `${agent} heeft actie uitgevoerd…`;
    case "n8n":
      return `${agent} werkt via automation…`;
    default:
      return `${agent} antwoordt…${badge}`;
  }
}

export function motorStatusPhaseLabel(
  phase: string | undefined,
  klant: string
): string {
  const agent = chatAgentName(klant);
  switch (phase) {
    case "web_research":
      return `${agent} zoekt op het web…`;
    case "fallback":
      return `${agent} werkt je opdracht af…`;
    case "thinking":
    default:
      return `${agent} denkt na…`;
  }
}
