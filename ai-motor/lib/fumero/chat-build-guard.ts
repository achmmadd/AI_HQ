import { extractHtmlFenceFromText } from "@/lib/extract-artifact-from-message";
import { sanitizeGoalText } from "@/lib/fumero/max-goal-shared";

const CODE_FENCE_RE = /```[\s\S]*?```/g;
const RAW_HTML_DOC_RE =
  /<!DOCTYPE[\s\S]*?<\/html\s*>|<html[\s>][\s\S]*?<\/html\s*>/gi;

/** True when assistant text looks like generated build output, not conversation. */
export function looksLikeBuildCodeInChat(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (extractHtmlFenceFromText(t)) return true;
  if (RAW_HTML_DOC_RE.test(t)) return true;
  const fences = t.match(CODE_FENCE_RE) ?? [];
  if (fences.some((f) => f.length > 280)) return true;
  if (
    /```(?:html|htm|jsx|tsx|javascript|js|css)\b/i.test(t) &&
    t.length > 120
  ) {
    return true;
  }
  return false;
}

const DEFAULT_CODER_CHAT_FALLBACK =
  "Ik houd het gesprek hier in chat — de code komt in het previewpaneel zodra je bouwt. Beschrijf wat je wilt, of zeg **ga door** na verduidelijking.";

/** Strip build artifacts from chat; keep human-readable prose. */
export function sanitizeBuildChatContent(
  text: string,
  fallback = DEFAULT_CODER_CHAT_FALLBACK
): string {
  let clean = text.replace(CODE_FENCE_RE, "").replace(RAW_HTML_DOC_RE, "");
  clean = clean.replace(/\n{3,}/g, "\n\n").trim();
  if (!clean || looksLikeBuildCodeInChat(clean)) return fallback;
  return clean;
}

export function formatClarifyAckMessage(): string {
  return "Genoteerd. Nog iets toevoegen, of zeg **ga door** om te bouwen — dan zie je alles in het previewpaneel.";
}

export function formatPreviewOpenedMessage(): string {
  return "Preview geopend rechts — daar zie je je concept live.";
}

/** Strip HTML fragments from status lines shown in composer UI. */
export function sanitizeUiStatusText(text: string | null | undefined): string | null {
  if (!text?.trim()) return null;
  const clean = sanitizeGoalText(text);
  return clean || null;
}

/** Chat bubble text in Bouwen/coder — never show raw build output. */
export function resolveAssistantChatDisplayContent(
  content: string,
  opts?: { coderMode?: boolean; streaming?: boolean }
): string {
  if (!opts?.coderMode || !content.trim()) return content;
  if (opts.streaming && looksLikeBuildCodeInChat(content)) return "";
  return sanitizeBuildChatContent(content);
}
