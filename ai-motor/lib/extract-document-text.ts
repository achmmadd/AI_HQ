import { CHAT_UPLOAD_MAX_BYTES } from "@/lib/chat-upload";

const MAX_BYTES = CHAT_UPLOAD_MAX_BYTES;

/** Strip HTML naar platte tekst (geen externe parser). */
export function htmlBufferToText(buffer: Buffer): string {
  let html = buffer.toString("utf-8");
  if (html.charCodeAt(0) === 0xfeff) html = html.slice(1);
  html = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n");
  const stripped = withBreaks.replace(/<[^>]+>/g, " ");
  return stripped
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n: string) =>
      String.fromCharCode(Number.parseInt(n, 10))
    )
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractDocumentText(
  buffer: Buffer,
  mime: string,
  filename: string
): Promise<string> {
  if (buffer.length > MAX_BYTES) {
    throw new Error(`Bestand te groot (max ${MAX_BYTES / 1024 / 1024} MB)`);
  }
  const lower = filename.toLowerCase();

  if (
    mime === "text/plain" ||
    lower.endsWith(".txt") ||
    mime === "text/markdown" ||
    lower.endsWith(".md")
  ) {
    return buffer.toString("utf-8");
  }

  if (
    lower.endsWith(".docx") ||
    mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = (await import("mammoth")).default;
    const { value } = await mammoth.extractRawText({ buffer });
    return (value || "").trim();
  }

  if (
    mime === "text/html" ||
    lower.endsWith(".html") ||
    lower.endsWith(".htm")
  ) {
    return htmlBufferToText(buffer);
  }

  if (lower.endsWith(".pdf") || mime === "application/pdf") {
    type PdfParseFn = (b: Buffer) => Promise<{ text?: string }>;
    const loaded = (await import("pdf-parse")) as unknown;
    const pdfParse: PdfParseFn =
      typeof loaded === "function"
        ? (loaded as PdfParseFn)
        : typeof (loaded as { default?: unknown }).default === "function"
          ? (loaded as { default: PdfParseFn }).default
          : (() => {
              throw new Error("pdf-parse kon niet worden geladen");
            })();
    const data = await pdfParse(buffer);
    return String(data.text || "").trim();
  }

  throw new Error(
    "Niet-ondersteund bestandstype. Gebruik pdf, html, docx, txt of md."
  );
}
