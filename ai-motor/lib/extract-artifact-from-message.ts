/** Server-side: haal HTML uit assistant-tekst (zelfde prioriteit als useArtifact). */
import { stripBuilderTransportMarkers } from "@/lib/builder-code.live";

const FENCE_RE = /```([a-zA-Z0-9_-]+)?\s*\n([\s\S]*?)```/g;

function normalizeLang(lang: string | undefined): string | null {
  const key = (lang ?? "").trim().toLowerCase();
  if (key === "html" || key === "htm") return "html";
  return null;
}

/**
 * Geeft de eerste ```html block (prioriteit) of ruwe HTML-indruk als die groot genoeg is.
 */
export function extractHtmlFenceFromText(text: string): string | null {
  const cleanText = stripBuilderTransportMarkers(text);
  const blocks = Array.from(cleanText.matchAll(FENCE_RE)) as RegExpMatchArray[];
  for (const match of blocks) {
    const lang = normalizeLang(match[1]);
    const code = (match[2] ?? "").trim();
    if (lang === "html" && code) return code;
  }

  const raw = cleanText.trim();
  if (/<(html|body|main|section|div|article)[\s>]/i.test(raw) && raw.length > 60) {
    return raw;
  }
  return null;
}

export function extractLastHtmlFromMessages(
  messages: { role: string; content: string }[]
): string | null {
  const assistants = [...messages].filter((m) => m.role === "assistant").reverse();
  for (const m of assistants) {
    const html = extractHtmlFenceFromText(m.content);
    if (html) return html;
  }
  return null;
}
