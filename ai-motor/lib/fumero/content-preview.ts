import { stripChatOutput } from "@/lib/strip-response";
import type { FumeroStudioContentType } from "@/lib/fumero-quick-actions";
import type { ProjectRuntime } from "@/lib/fumero/project-runtime";

export type FumeroContentPreviewPayload = {
  contentType: FumeroStudioContentType | string;
  platform: string;
  content?: string;
  mediaUrl?: string;
  mediaKind?: "image" | "text" | "script";
  postId?: number;
  status: "generating" | "ready" | "error";
  title?: string;
  /** Long-form Canvas: editable document in side panel. */
  canvasMode?: boolean;
};

export type FumeroLivePreviewPayload = {
  title: string;
  previewUrl: string | null;
  status: "generating" | "ready";
  previewEpoch?: number;
  /** Concept version label in live preview panel. */
  version?: number;
  /** Build-fase voor coder preview timeline. */
  buildPhase?: string;
  building?: boolean;
  /** Widget embed snippet (na build). */
  embedCode?: string | null;
  /** Bouw-runtime voor preview-badge (Widget | Website | App). */
  runtime?: ProjectRuntime;
  /** UX-check beschikbaar (HTML-tools). */
  uxReviewAvailable?: boolean;
};

/** Strip Factory OS envelope from generated content before UI preview. */
export function cleanGeneratedContent(raw: string): string {
  return stripChatOutput(raw).trim();
}

export function contentPreviewTitle(
  contentType: string,
  platform: string
): string {
  const labels: Record<string, string> = {
    social_post: "Social post",
    product_photo: "Productfoto",
    banner: "Banner",
    social_video: "Video-script",
    product_text: "Producttekst",
    email_template: "E-mail",
    seo_article: "SEO-artikel",
    blog: "Blog",
  };
  const kind = labels[contentType] ?? contentType.replace(/_/g, " ");
  return `${kind} · ${platform}`;
}

export function normalizePreviewPlatform(
  platform: string
): "instagram" | "tiktok" | "linkedin" {
  const p = platform.toLowerCase();
  if (p.includes("tiktok")) return "tiktok";
  if (p.includes("linkedin")) return "linkedin";
  return "instagram";
}

/** User-facing concept version label in Fumero UI. */
export function fumeroConceptVersionLabel(version: number): string {
  return `Versie ${version} · nog niet live`;
}
