import type { FumeroStudioContentType } from "@/lib/fumero-quick-actions";
import { isFumeroContentType } from "@/lib/fumero-quick-actions";

export type MaxContentChatAction = {
  type: "content_generate";
  contentType: FumeroStudioContentType;
  platform: string;
  prompt: string;
};

const GENERATE_VERB_RE =
  /\b(genereer|genereer\s+mij|maak\s+(een\s+)?|schrijf\s+(een\s+)?|creëer|produceer|generate|create)\b/i;

const CONTENT_NOUN_RE =
  /\b(instagram|ig\s*post|social\s*post|caption|blog|artikel|seo|longform|long\s*form|canvas|producttekst|product\s*tekst|productfoto|product\s*foto|banner|campagne\s*banner|e-?mail|mail|nieuwsbrief|video\s*script|videoscript|voice\s*over|voiceover|tiktok|reel)\b/i;

const CANVAS_INTENT_RE =
  /\b(blog|seo[\s-]?artikel|longform|long\s*form|canvas|whitepaper|gids|handleiding|lange\s*tekst)\b/i;

export type MaxCanvasChatAction = {
  type: "canvas_generate";
  contentType: "seo_article" | "product_text";
  platform: string;
  prompt: string;
};

export function isCanvasContentType(
  type: string
): type is MaxCanvasChatAction["contentType"] {
  return type === "seo_article" || type === "product_text";
}

const NAV_ONLY_RE =
  /\b(open|ga\s+naar|naar|bekijk|toon|lijst)\s+(de\s+)?(bibliotheek|content\s*studio|library)\b/i;

function detectPlatform(prompt: string): string {
  const p = prompt.toLowerCase();
  if (/\btiktok\b/.test(p)) return "tiktok";
  if (/\b(linkedin)\b/.test(p)) return "linkedin";
  if (/\b(facebook|fb)\b/.test(p)) return "facebook";
  if (/\b(instagram|ig\b)/.test(p)) return "instagram";
  return "instagram";
}

function detectContentType(prompt: string): FumeroStudioContentType {
  const p = prompt.toLowerCase();
  if (/\b(product\s*foto|productfoto|packshot|lifestyle\s*foto)\b/.test(p)) {
    return "product_photo";
  }
  if (/\b(banner|campagne\s*banner|hero\s*banner|sale\s*banner)\b/.test(p)) {
    return "banner";
  }
  if (/\b(video\s*script|videoscript|reel\s*script|shotlist|tiktok\s*script)\b/.test(p)) {
    return "social_video";
  }
  if (/\b(voice\s*over|voiceover|inspreektekst)\b/.test(p)) {
    return "social_video";
  }
  if (/\b(e-?mail|mail|nieuwsbrief|transactionele\s*mail|winkelwagen)\b/.test(p)) {
    return "email_template";
  }
  if (/\b(seo|blog|artikel|longform|long\s*form|canvas|whitepaper|gids)\b/.test(p)) {
    return "seo_article";
  }
  if (/\b(producttekst|product\s*tekst|beschrijving|webshop\s*copy)\b/.test(p)) {
    return "product_text";
  }
  return "social_post";
}

export function resolveMaxCanvasChatAction(
  prompt: string
): MaxCanvasChatAction | null {
  const t = prompt.trim();
  if (!t || t.length < 12) return null;
  if (!CANVAS_INTENT_RE.test(t) && !/\b(schrijf|genereer|maak)\b.*\b(blog|artikel|seo)\b/i.test(t)) {
    return null;
  }
  const contentType =
    /\b(producttekst|product\s*tekst|beschrijving|webshop\s*copy)\b/i.test(t)
      ? "product_text"
      : "seo_article";
  return {
    type: "canvas_generate",
    contentType,
    platform: contentType === "product_text" ? "webshop" : "blog",
    prompt: t,
  };
}

export function resolveMaxContentChatAction(
  prompt: string
): MaxContentChatAction | null {
  const t = prompt.trim();
  if (!t || t.length < 12) return null;
  if (NAV_ONLY_RE.test(t)) return null;

  const hasGenerate = GENERATE_VERB_RE.test(t);
  const hasContentNoun = CONTENT_NOUN_RE.test(t);

  if (!hasGenerate && !hasContentNoun) return null;
  if (!hasGenerate && hasContentNoun && t.length < 28) return null;

  const contentType = detectContentType(t);

  return {
    type: "content_generate",
    contentType,
    platform: detectPlatform(t),
    prompt: t,
  };
}

export function contentTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    social_post: "social post",
    product_photo: "productfoto",
    banner: "banner",
    social_video: "video-script",
    product_text: "producttekst",
    email_template: "e-mail",
    seo_article: "SEO-artikel",
  };
  return labels[type] ?? type.replace(/_/g, " ");
}

export function formatContentSavedMarkdown(opts: {
  contentType: string;
  platform: string;
  postId?: number;
  mediaKind?: string;
}): string {
  const kind = contentTypeLabel(opts.contentType);
  const libLink = opts.postId
    ? `[Open in bibliotheek](/fumero/bibliotheek)`
    : "[Bibliotheek](/fumero/bibliotheek)";
  const canvasHint =
    opts.contentType === "seo_article" || opts.contentType === "product_text";
  const lines = [
    canvasHint
      ? `**${kind}** staat in Schrijven rechts — tik **Open** in de thread of bewerk in het paneel.`
      : `**${kind}** voor **${opts.platform}** staat klaar — preview rechts, opgeslagen als concept.`,
    "",
    libLink,
  ];
  if (opts.mediaKind === "image") {
    lines.push("", "_Afbeelding in het preview-paneel — open bibliotheek om te downloaden._");
  } else {
    lines.push("", "_Volledige tekst staat in het preview-paneel rechts._");
  }
  return lines.join("\n");
}

export function isKnownContentType(v: string): v is FumeroStudioContentType {
  return isFumeroContentType(v);
}
