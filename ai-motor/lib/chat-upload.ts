/** Gedeelde limieten voor chat-bijlagen (client + server). */
export const CHAT_UPLOAD_MAX_BYTES = 25 * 1024 * 1024;

export const CHAT_UPLOAD_MAX_WEBHOOK_CHARS = 12_000;

export const CHAT_UPLOAD_MAX_MESSAGE_EXCERPT = 12_000;

/** Boven deze grootte: geen trage n8n-analyse bij upload, alleen lokale excerpt. */
export const CHAT_UPLOAD_SKIP_N8N_ANALYSIS_BYTES = 2 * 1024 * 1024;

export const CHAT_UPLOAD_ACCEPT =
  ".pdf,.html,.htm,.txt,.md,.docx,.png,.jpg,.jpeg,.webp,.gif,application/pdf,text/html,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp,image/gif";

const ALLOWED_EXT = new Set([
  ".pdf",
  ".html",
  ".htm",
  ".txt",
  ".md",
  ".docx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
]);

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);

export function isChatUploadImageFileName(name: string): boolean {
  const lower = name.toLowerCase();
  return [...IMAGE_EXT].some((ext) => lower.endsWith(ext));
}

export function isChatUploadFileNameAllowed(name: string): boolean {
  const lower = name.toLowerCase();
  return [...ALLOWED_EXT].some((ext) => lower.endsWith(ext));
}

export function validateChatUploadFile(file: File): string | null {
  if (file.size > CHAT_UPLOAD_MAX_BYTES) {
    return `Bestand te groot (max ${CHAT_UPLOAD_MAX_BYTES / 1024 / 1024} MB).`;
  }
  if (!isChatUploadFileNameAllowed(file.name)) {
    return "Alleen PDF, HTML, TXT, MD, DOCX of afbeeldingen (PNG, JPG, WebP).";
  }
  return null;
}

export type ChatUploadApiResponse = {
  filename?: string;
  analysis?: string;
  message?: string;
  extracted_chars?: number;
  excerpt?: string;
  excerpt_truncated?: boolean;
  media_url?: string;
  media_kind?: "image" | "document";
  error?: string;
};

export function truncateForWebhook(text: string): {
  text: string;
  truncated: boolean;
} {
  if (text.length <= CHAT_UPLOAD_MAX_WEBHOOK_CHARS) {
    return { text, truncated: false };
  }
  return {
    text: text.slice(0, CHAT_UPLOAD_MAX_WEBHOOK_CHARS),
    truncated: true,
  };
}

export function buildUploadChatMessage(
  fileName: string,
  data: ChatUploadApiResponse
): string {
  if (data.media_kind === "image" && data.media_url) {
    return [
      `Ik heb een afbeelding geüpload: **${fileName}**.`,
      "",
      `![${fileName}](${data.media_url})`,
      "",
      data.analysis?.trim()
        ? `**Context:** ${data.analysis.trim()}`
        : "Gebruik deze afbeelding als visuele context of referentie voor img2img.",
    ].join("\n");
  }
  const analysis =
    typeof data.analysis === "string" && data.analysis.trim()
      ? data.analysis.trim()
      : "Bestand opgeslagen.";
  const excerpt =
    typeof data.excerpt === "string" && data.excerpt.trim()
      ? data.excerpt.trim()
      : "";
  const truncated = Boolean(data.excerpt_truncated);
  const chars =
    typeof data.extracted_chars === "number" ? data.extracted_chars : 0;

  let body = `Ik heb "${fileName}" geüpload`;
  if (chars > 0) {
    body += ` (${chars.toLocaleString("nl-NL")} tekens uit document)`;
  }
  body += ".\n\n";
  if (excerpt) {
    body += "**Inhoud (fragment):**\n\n";
    body += excerpt;
    if (truncated) {
      body += "\n\n… (document ingekort voor context)";
    }
    body += "\n\n";
  }
  body += `**Samenvatting:** ${analysis}`;
  return body;
}
