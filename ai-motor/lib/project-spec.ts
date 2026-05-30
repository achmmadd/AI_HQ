import { anthropicComplete, getAnthropicApiKey } from "@/lib/anthropic-messages";
import { buildProjectBuildPreamble } from "@/lib/project-preamble";
import { callFactoryN8n, extractMessage } from "@/lib/chat-n8n";
import type { ProjectSpec } from "@/lib/project-types";

const SPEC_JSON_HINT = `Antwoord ALLEEN met geldig JSON (geen markdown-fences):
{"title":"korte titel","pages":["pagina1"],"features":["feature1"],"description":"1 zin samenvatting"}`;

function extractJsonObject(text: string): Record<string, unknown> | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeSpec(
  raw: Record<string, unknown>,
  klant: string,
  fallbackTitle: string
): ProjectSpec {
  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim().slice(0, 120)
      : fallbackTitle;
  const pages = Array.isArray(raw.pages)
    ? raw.pages
        .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
        .map((p) => p.trim().slice(0, 80))
        .slice(0, 12)
    : ["Home"];
  const features = Array.isArray(raw.features)
    ? raw.features
        .filter((f): f is string => typeof f === "string" && f.trim().length > 0)
        .map((f) => f.trim().slice(0, 120))
        .slice(0, 20)
    : [];
  const description =
    typeof raw.description === "string" ? raw.description.trim().slice(0, 500) : undefined;

  return {
    title,
    pages: pages.length ? pages : ["Home"],
    features,
    klant,
    ...(description ? { description } : {}),
  };
}

function heuristicSpec(prompt: string, klant: string): ProjectSpec {
  const words = prompt.trim().split(/\s+/).slice(0, 8).join(" ");
  const title = words.length > 60 ? `${words.slice(0, 57)}…` : words || "Nieuw project";
  const lower = prompt.toLowerCase();
  const pages: string[] = ["Home"];
  if (/\bdashboard\b/i.test(lower)) pages.push("Dashboard");
  if (/\b(reserver|booking|agenda)\b/i.test(lower)) pages.push("Reserveringen");
  if (/\b(menu\b|kaart)\b/i.test(lower)) pages.push("Menu");
  if (/\b(contact|formulier)\b/i.test(lower)) pages.push("Contact");
  const features: string[] = [];
  if (/\bauth|login|inlog\b/i.test(lower)) features.push("Authenticatie");
  if (/\btabel|overzicht|lijst\b/i.test(lower)) features.push("Data-overzicht");
  if (/\bnotificat|telegram\b/i.test(lower)) features.push("Notificaties");
  return { title, pages, features, klant, description: prompt.trim().slice(0, 300) };
}

async function specViaAnthropic(
  prompt: string,
  klant: string,
  preamble: string
): Promise<string> {
  const { text } = await anthropicComplete({
    system:
      preamble +
      "\n\nJe parseert business-prompts naar product-specificaties voor webprojecten.",
    messages: [
      {
        role: "user",
        content: `${SPEC_JSON_HINT}\n\nPrompt:\n${prompt.trim()}`,
      },
    ],
    maxTokens: 1024,
  });
  return text;
}

async function specViaN8n(
  prompt: string,
  klant: string,
  preamble: string
): Promise<string> {
  const { ok, data } = await callFactoryN8n({
    prompt: preamble + SPEC_JSON_HINT + "\n\nPrompt:\n" + prompt.trim(),
    klant,
    afdeling: "fabriek",
    intent: "build",
    type: "project_spec",
  });
  if (!ok) throw new Error("n8n project-spec mislukt");
  return extractMessage(data);
}

/** Parse gebruikersprompt → ProjectSpec (Anthropic → n8n → heuristiek). */
export async function parseProjectSpec(
  prompt: string,
  klant: string
): Promise<ProjectSpec> {
  const fallbackTitle =
    prompt.trim().split(/\s+/).slice(0, 6).join(" ") || "Nieuw project";
  const preamble = await buildProjectBuildPreamble(klant, prompt);

  let rawText = "";
  try {
    if (getAnthropicApiKey()) {
      rawText = await specViaAnthropic(prompt, klant, preamble);
    } else {
      rawText = await specViaN8n(prompt, klant, preamble);
    }
  } catch {
    return heuristicSpec(prompt, klant);
  }

  const obj = extractJsonObject(rawText);
  if (!obj) return heuristicSpec(prompt, klant);
  return normalizeSpec(obj, klant, fallbackTitle);
}
