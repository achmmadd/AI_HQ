import type { ChatMessage } from "@/lib/types";
import type { FumeroDeployType } from "@/lib/fumero/tool-templates";
import type { FumeroToolQuickReply } from "@/lib/fumero/max-tool-chat";

/** Live tool-builder kaart in Fumero Max-chat. */
export type FumeroToolCardPayload = {
  toolId: number;
  name: string;
  previewUrl: string | null;
  deployType: FumeroDeployType;
  status: "generating" | "concept" | "published";
  embedCode?: string | null;
  internalUrl?: string | null;
  basePrompt?: string;
  /** Concept version number (shown as Concept vN). */
  version?: number;
  /** Cache-bust epoch for iframe preview refresh after iterate. */
  previewEpoch?: number;
  /** Fase 2: subtle model badge (Sonnet / Builder). */
  builderLabel?: string;
  /** Na publish: weergaven uit garage (indien API levert). */
  statsViews?: number;
  statsInteractions?: number;
  /** Tool slug (garage / Code workspace link). */
  slug?: string;
  /** Fase 5: optional extras when reused for AppCardPayload in unified card UI */
  tables?: number;
  authRequired?: boolean;
  hasPwa?: boolean;
};

/** Fase 5: Live full-stack app card (Lovable-style) in chat. */
export type AppCardPayload = {
  slug: string;
  name: string;
  type: "widget" | "internal" | "customer";
  version: number;
  status: "generating" | "concept" | "published";
  previewUrl: string | null; // e.g. /apps/slug?preview=1 or embed equiv
  embedCode?: string | null;
  internalUrl?: string | null;
  tables?: number;
  authRequired?: boolean;
  hasPwa?: boolean;
  previewEpoch?: number;
  builderLabel?: string;
};

/** Chat UI-bericht met optionele usage na een turn. */
export type MotorsChatMessage = ChatMessage & {
  usageLine?: string;
  usageKind?: "motor" | "turbo" | "onderzoek" | "automation" | "lokaal";
  promptTokens?: number;
  completionTokens?: number;
  usageModel?: string;
  /** Fumero Tools Builder — inline preview + deploy. */
  toolCard?: FumeroToolCardPayload;
  /** Fase 5: full-stack AppCard for Lovable builder (reuses card UI, live preview + Pas aan + Deploy) */
  appCard?: AppCardPayload;
  /** Sjabloon-knoppen onder Max-antwoord bij tool-intent. */
  toolQuickReplies?: FumeroToolQuickReply[];
  /** Fumero content — thumbnail in thread (preview in side panel). */
  contentCard?: {
    mediaUrl?: string;
    mediaKind?: "image" | "text" | "script";
    postId?: number;
    contentType?: string;
    platform?: string;
    canvasMode?: boolean;
    title?: string;
    contentSnippet?: string;
    documentContent?: string;
  };
};
