"use client";

import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  ChevronDown,
  ClipboardList,
  BookMarked,
  Mic,
  Paperclip,
  PanelLeft,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Loader2,
  Send,
  Square,
  Trash2,
  PanelRightOpen,
  MousePointer2,
  Plug,
  Grid3X3,
  ScanEye,
  Zap,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMotorsChat } from "@/hooks/useMotorsChat";
import { useCompanyStore, chatKlantForWorkspace, getWorkspaceTheme } from "@/stores/useCompanyStore";
import { AgentAvatar } from "@/components/AgentAvatar";
import { MotorsChatMarkdown } from "@/components/motors-chat-markdown";
import { MessageFeedback } from "@/components/message-feedback";
import { fetchJsonChecked, fetchJsonOptional } from "@/lib/fetch-json-client";
import { cn } from "@/lib/utils";
import { groupConversationsByDate, groupFumeroChatThreads, deriveConversationTitleFromMessage, type ConversationListItem } from "@/lib/conversation-grouping";
import { isBuildLikePrompt } from "@/lib/build-intent-ext";
import {
  isProjectIterationPrompt,
  isProjectStartPrompt,
} from "@/lib/build-intent-project";
import {
  motorsActionLabel,
  resolveMotorsChatAction,
} from "@/lib/motors-orchestrator";
import {
  buildUploadChatMessage,
  CHAT_UPLOAD_ACCEPT,
  validateChatUploadFile,
  type ChatUploadApiResponse,
} from "@/lib/chat-upload";
import { useAgentReadiness } from "@/hooks/useAgentReadiness";
import { useLayoutStore } from "@/stores/useLayoutStore";
import { MotorTurboButton } from "@/components/motor-turbo-button";
import { MotorPlanButton } from "@/components/motor-plan-button";
import { MotorUsageStrip } from "@/components/motor-usage-strip";
import {
  FumeroComposerToolbar,
  type FumeroComposerMenuAction,
  type FumeroComposerMode,
  type FumeroCoderOverflowItem,
} from "@/components/fumero/fumero-composer-toolbar";
import {
  readStoredFumeroModelTier,
  writeStoredFumeroModelTier,
  FUMERO_MODEL_TIERS,
  type FumeroComposerModelTier,
} from "@/lib/fumero/composer-model-tier";
import {
  FUMERO_CMD_EVENTS,
  type FumeroCmdFocusComposerDetail,
  type FumeroCmdSetComposerModeDetail,
} from "@/lib/fumero/command-palette";
import { BOKAS_CHAT_SUGGESTIONS } from "@/lib/bokas-quick-actions";
import {
  FUMERO_CHAT_SUGGESTIONS,
  type FumeroChatStarterWire,
} from "@/lib/fumero-quick-actions";
import { FumeroChatStarterCards } from "@/components/fumero/ops/fumero-chat-starter-cards";
import { BouwenEmptyHome } from "@/components/fumero/builder/bouwen-empty-home";
import {
  formatMaxBriefingDetailMarkdown,
  resolveMaxChatAction,
} from "@/lib/fumero/max-briefing-chat";
import { getTemplate, templatePreviewDataUrl } from "@/lib/fumero/tool-templates";
import {
  deployTypeForTemplate,
  deriveToolName,
  FUMERO_TOOL_QUICK_REPLIES,
  formatToolDeployedMarkdown,
  buildInitialToolPrompt,
  mergeToolPrompt,
  CODER_BUILD_TRIGGER_RE,
  isCoderQuestionOnly,
  resolveMaxToolChatAction,
  resolveTemplateFromQuickReply,
  resolveTemplateFromUserText,
  toolIntentAssistantIntro,
  detectFullAppIntent,
} from "@/lib/fumero/max-tool-chat";
import {
  formatContentSavedMarkdown,
  resolveMaxCanvasChatAction,
  resolveMaxContentChatAction,
} from "@/lib/fumero/max-content-chat";
import {
  FUMERO_RESEARCH_PREFILL,
  fumeroComposerPlaceholder,
} from "@/lib/fumero/composer-actions";
import {
  cleanGeneratedContent,
  contentPreviewTitle,
  fumeroConceptVersionLabel,
  type FumeroContentPreviewPayload,
  type FumeroLivePreviewPayload,
} from "@/lib/fumero/content-preview";
import {
  createFumeroTool,
  fetchToolDetail,
  iterateFumeroTool,
  publishFumeroTool,
  type ToolGenerationProgress,
} from "@/lib/fumero/tool-chat-client";
import {
  createFullApp,
  fetchAppDetail,
  iterateFullApp,
  publishFullApp,
  type AppDetail,
} from "@/lib/apps/apps-chat-client";
import { FumeroToolCard } from "@/components/fumero/features/fumero-tool-card";
import {
  FumeroPublishModal,
  type FumeroPublishModalPayload,
} from "@/components/fumero/features/fumero-publish-modal";
import { CODER_BUILD_PHASES } from "@/lib/fumero/coder-build-phases";
import {
  monotonicCoderBuildPhase,
} from "@/lib/fumero/bouwen-status-labels";
import {
  formatFumeroBuilderError,
  cacheBustPreviewUrl,
} from "@/lib/fumero/builder-config";
import { showFumeroToast } from "@/lib/fumero/fumero-toast";
import { FumeroConnectorsPanel } from "@/components/fumero/FumeroConnectorsPanel";
import {
  augmentPromptWithFumeroConnectors,
  formatFumeroScrapeChatNotice,
} from "@/lib/connectors/fumero-context";
import {
  enrichCasualBouwenPrompt,
  isFumeroSiteCheckChatIntent,
} from "@/lib/fumero/casual-prompt";
import { fumeroStuckHintLabel } from "@/lib/fumero/fumero-live-steps";
import { fumeroPrepStatusLabel } from "@/lib/fumero/fumero-prep-status";
import {
  isBouwenContinueIntent,
  mergeBouwenClarifyPrompt,
} from "@/lib/fumero/bouwen-chat-intents";
import {
  readPendingBouwenClarify,
  writePendingBouwenClarify,
} from "@/lib/fumero/bouwen-clarify-session";
import {
  formatClarifyAckMessage,
  formatPreviewOpenedMessage,
  resolveAssistantChatDisplayContent,
  sanitizeUiStatusText,
} from "@/lib/fumero/chat-build-guard";
import {
  bouwenClarifyingQuestions,
  dispatchFumeroGoalUpdated,
  formatBouwenClarifyAssistantMessage,
  parseMaxGoalCommand,
} from "@/lib/fumero/max-goal-shared";
import { shouldScrapeUrlsForMaxChat } from "@/lib/fumero/scrape-url-chat";
import { buildScrapeContextForToolBuild } from "@/lib/fumero/scrape-url-chat";
import { applyDesignerHints } from "@/lib/connectors/specialists";
import {
  EMPTY_BOUWEN_BRIDGE,
  type FumeroBouwenBridge,
} from "@/lib/fumero/bouwen-bridge";
import { motorPublicOrigin } from "@/lib/fumero/public-url";
import {
  fullAppPreviewUrl,
  normalizeMotorPublicUrl,
  resolveActiveBouwenRuntime,
  runtimeFromDeployType,
} from "@/lib/fumero/project-runtime";
import {
  readEnabledConnectors,
  setConnectorEnabled,
} from "@/lib/connectors/session";
import type { ConnectorId } from "@/lib/connectors/registry";
import type { FumeroToolCardPayload, AppCardPayload } from "@/lib/motors-chat-types";
import type { MaxCompanionConfig } from "@/components/motors-chat-workspace";
import type { ProjectStack } from "@/lib/project-types";

type ConversationRow = {
  id: number;
  klant: string;
  title: string;
  created_at: string;
  updated_at: string;
};

const SUGGESTED_PROMPTS = [
  {
    label: "Samenvatting",
    prompt: "Geef een korte samenvatting van wat we bespraken.",
  },
  {
    label: "Zoek op web",
    prompt:
      "Zoek op wat er actueel speelt rond ons bedrijf en geef 3 bronnen met URL.",
  },
  {
    label: "Actiepunten",
    prompt: "Lijst concrete actiepunten met eigenaar en deadline.",
  },
];

const UNIFIED_SUGGESTED_PROMPTS = [
  {
    label: "Bokas dashboard",
    prompt:
      "Bouw een Next.js reserveringen-dashboard voor Bokas met overzicht vandaag, tabel en donkere UI.",
  },
  {
    label: "MotorsAI clone",
    prompt:
      "Bouw een React chat-UI zoals MotorsAI met sidebar, berichten en donker thema.",
  },
  {
    label: "Menukaart",
    prompt:
      "Maak een interactieve menukaart voor het restaurant met categorieën en prijzen.",
  },
  {
    label: "Rekenmachine",
    prompt: "Maak een rekenmachine met groot display en donkere knoppen.",
  },
];

/** Eén regel samenvatting voor compacte tool-kaart in coder-split. */
function toolCardOneLineSummary(content: string): string | undefined {
  const t = content
    .replace(/\*\*/g, "")
    .replace(/[#*_`[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return undefined;
  const sentence = t.split(/[.!?]\s/)[0]?.trim() ?? t;
  return sentence.length > 160 ? `${sentence.slice(0, 157)}…` : sentence;
}

type SpeechRecCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function MotorTypingDots({
  accent,
  className,
}: {
  accent?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn("inline-flex gap-1", className)}
      aria-hidden
    >
      <span
        className={cn(
          "motors-typing-dot",
          accent && "bg-[color-mix(in_srgb,var(--fumero-accent)_70%,transparent)]"
        )}
      />
      <span
        className={cn(
          "motors-typing-dot",
          accent && "bg-[color-mix(in_srgb,var(--fumero-accent)_70%,transparent)]"
        )}
      />
      <span
        className={cn(
          "motors-typing-dot",
          accent && "bg-[color-mix(in_srgb,var(--fumero-accent)_70%,transparent)]"
        )}
      />
    </span>
  );
}

function MotorThinkingBlock({
  turbo,
  statusLabel,
  activities,
  agentLabel = "Motor",
  accent,
}: {
  turbo: boolean;
  statusLabel?: string | null;
  activities: string[];
  agentLabel?: string;
  accent?: boolean;
}) {
  const current =
    statusLabel ??
    activities[activities.length - 1] ??
    (turbo ? "Turbo denkt na…" : `${agentLabel} denkt na…`);

  return (
    <div className="space-y-2 text-text-secondary">
      <div className="inline-flex items-center gap-1.5">
        <MotorTypingDots accent={accent} />
        <span className="text-[14px] font-medium text-text-primary">
          {current}
        </span>
      </div>
      {activities.length > 1 && (
        <ul className="space-y-0.5 border-l border-border/50 pl-3 text-[12px] leading-snug text-text-secondary/90">
          {activities.slice(0, -1).map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Claude/Perplexity-achtige stappenfeed voor Max (prep + stream). */
function FumeroMaxActivityFeed({
  statusLabel,
  activities,
  stuckHint,
}: {
  statusLabel?: string | null;
  activities: string[];
  stuckHint?: string | null;
}) {
  const lines =
    activities.length > 0
      ? activities
      : statusLabel
        ? [statusLabel]
        : ["Max werkt…"];
  const current = statusLabel?.trim() || lines[lines.length - 1] || "Max werkt…";
  const completed =
    lines.length > 1 && lines[lines.length - 1] === current
      ? lines.slice(0, -1)
      : lines.filter((line) => line !== current);

  return (
    <div className="space-y-2">
      <ul className="max-h-52 space-y-1 overflow-y-auto border-l-2 border-[color-mix(in_srgb,var(--fumero-accent)_35%,transparent)] pl-3">
        {completed.map((line, i) => (
          <li
            key={`done-${i}-${line}`}
            className="flex items-start gap-2 text-[12px] leading-snug text-[var(--fumero-text-muted)]"
          >
            <span className="mt-0.5 shrink-0 font-semibold text-[var(--fumero-accent)]">
              ✓
            </span>
            <span>{line}</span>
          </li>
        ))}
        <li className="flex items-start gap-2 text-[13px] font-medium leading-snug text-[var(--fumero-text)]">
          <span className="mt-0.5 shrink-0">
            <MotorTypingDots accent />
          </span>
          <span>{current}</span>
        </li>
      </ul>
      {stuckHint ? (
        <p className="text-[11px] text-[var(--fumero-text-muted)]" aria-live="polite">
          {stuckHint}
        </p>
      ) : null}
    </div>
  );
}

function MotorStreamPulse({
  statusLabel,
  agentLabel = "Motor",
  accent,
}: {
  statusLabel?: string | null;
  agentLabel?: string;
  accent?: boolean;
}) {
  const label = statusLabel ?? `${agentLabel} antwoordt…`;
  return (
    <div
      className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-text-secondary"
      aria-live="polite"
    >
      <MotorTypingDots accent={accent} />
      <span>{label}</span>
    </div>
  );
}

export function MotorsChatPanel({
  embedded = false,
  layout = "default",
  unifiedMode = false,
  preferArtifactBuilds = false,
  preferProjectBuilds = false,
  onBuildArtifact,
  onProjectPrompt,
  hasActiveProject = false,
  projectStack = null,
  artifactBusy = false,
  externalStatusError = null,
  initialPrompt = null,
  initialToolId = null,
  initialAppSlug = null,
  initialComposerMode,
  onComposerModeChange,
  maxCompanion,
  onFumeroContentPreview,
  onFumeroLivePreview,
  onFumeroVisualEditModeChange,
  onRegisterVisualEditPick,
  bouwenWorkspace = false,
  onBouwenBridgeUpdate,
  onRegisterUxReview,
  onPublishSuccess,
}: {
  embedded?: boolean;
  layout?: "default" | "split";
  unifiedMode?: boolean;
  preferArtifactBuilds?: boolean;
  preferProjectBuilds?: boolean;
  onBuildArtifact?: (prompt: string) => Promise<void>;
  onProjectPrompt?: (
    prompt: string,
    conversationId?: number
  ) => Promise<void>;
  hasActiveProject?: boolean;
  projectStack?: ProjectStack | null;
  artifactBusy?: boolean;
  externalStatusError?: string | null;
  /** Auto-verstuur bij openen (bijv. ?q= vanuit Fumero composer). */
  initialPrompt?: string | null;
  /** Bestaande tool bewerken (bv. ?tool= vanuit garage). */
  initialToolId?: number | null;
  /** Fase 5: bestaande full app laden/bewerken in chat (bv. ?app=slug vanuit garage). */
  initialAppSlug?: string | null;
  /** Fumero: start composer in coder/foto/canvas/online (bv. ?mode=coder). */
  initialComposerMode?: FumeroComposerMode;
  /** Fumero: workspace sync voor vaste preview-split in coder-modus. */
  onComposerModeChange?: (mode: FumeroComposerMode) => void;
  maxCompanion?: MaxCompanionConfig;
  /** Fumero: content preview in rechter paneel (Instagram post, productfoto, …). */
  onFumeroContentPreview?: (preview: FumeroContentPreviewPayload | null) => void;
  /** Fumero: tool/app iframe preview in rechter paneel. */
  onFumeroLivePreview?: (preview: FumeroLivePreviewPayload | null) => void;
  onFumeroVisualEditModeChange?: (active: boolean) => void;
  onRegisterVisualEditPick?: (handler: (hint: string) => void) => void;
  /** /fumero/bouwen dedicated workspace */
  bouwenWorkspace?: boolean;
  onBouwenBridgeUpdate?: (bridge: FumeroBouwenBridge) => void;
  onRegisterUxReview?: (fn: () => Promise<void>) => void;
  onPublishSuccess?: (payload: FumeroPublishModalPayload) => void;
} = {}) {
  const workspace = useCompanyStore((s) => s.workspace);
  const company = chatKlantForWorkspace(workspace);
  const agentTheme = getWorkspaceTheme(workspace);
  const router = useRouter();
  const motorChatMode = useLayoutStore((s) => s.motorChatMode);
  const setMotorChatMode = useLayoutStore((s) => s.setMotorChatMode);
  const previewPanelOpen = useLayoutStore((s) => s.previewPanelOpen);
  const setPreviewPanelOpen = useLayoutStore((s) => s.setPreviewPanelOpen);
  const planMode = useLayoutStore((s) => s.planMode);
  const togglePlanMode = useLayoutStore((s) => s.togglePlanMode);
  const agentMode = motorChatMode === "motor_pro";
  const [fumeroTurboOn, setFumeroTurboOn] = useState(false);
  const [fumeroComposerMode, setFumeroComposerMode] =
    useState<FumeroComposerMode>(
      bouwenWorkspace ? "coder" : (initialComposerMode ?? "default")
    );
  const fumeroCanvasMode = fumeroComposerMode === "canvas";
  const fumeroCoderMode = fumeroComposerMode === "coder";
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    number | undefined
  >(undefined);
  const sidebarOpen = useLayoutStore((s) => s.chatThreadsOpen);
  const setChatThreadsOpen = useLayoutStore((s) => s.setChatThreadsOpen);
  const [threadSearch, setThreadSearch] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [convLoadError, setConvLoadError] = useState<string | null>(null);
  const [slowConvLoad, setSlowConvLoad] = useState(false);
  const [fumeroModelTier, setFumeroModelTier] =
    useState<FumeroComposerModelTier>(bouwenWorkspace ? "normaal" : "flash");
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [enabledConnectors, setEnabledConnectors] = useState<ConnectorId[]>([]);
  const [knowledgeSaveMsgId, setKnowledgeSaveMsgId] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (initialComposerMode) {
      setFumeroComposerMode(initialComposerMode);
      if (initialComposerMode === "coder" && !bouwenWorkspace) {
        setPreviewPanelOpen(true);
      }
    }
  }, [initialComposerMode, bouwenWorkspace, setPreviewPanelOpen]);

  useEffect(() => {
    if (bouwenWorkspace) setChatThreadsOpen(false);
  }, [bouwenWorkspace, setChatThreadsOpen]);

  useEffect(() => {
    if (bouwenWorkspace) {
      setPreviewPanelOpen(false);
    }
  }, [bouwenWorkspace, setPreviewPanelOpen]);

  useEffect(() => {
    onComposerModeChange?.(fumeroComposerMode);
    if (fumeroComposerMode === "coder" && !bouwenWorkspace) {
      setPreviewPanelOpen(true);
    }
  }, [fumeroComposerMode, bouwenWorkspace, onComposerModeChange, setPreviewPanelOpen]);

  const refreshConversations = useCallback(async () => {
    const data = await fetchJsonChecked<{ conversations?: ConversationRow[] }>(
      `/api/conversations?klant=${encodeURIComponent(company)}`,
      { credentials: "include" }
    );
    const rows = data.conversations ?? [];
    setConversations(rows);
    return rows;
  }, [company]);

  const loadConversations = useCallback(async () => {
    setConvLoadError(null);
    setSlowConvLoad(false);
    setActiveConversationId(undefined);
    setConversations([]);

    const data = await fetchJsonChecked<{ conversations?: ConversationRow[] }>(
      `/api/conversations?klant=${encodeURIComponent(company)}`,
      { credentials: "include" }
    );
    let rows = data.conversations ?? [];
    if (rows.length === 0) {
      const row = await fetchJsonChecked<ConversationRow>("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ klant: company }),
      });
      rows = [row];
    }
    setConversations(rows);
    const cParam =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("c")
        : null;
    let pickId = rows[0]?.id;
    if (cParam && /^\d+$/.test(cParam)) {
      const cid = Number(cParam);
      if (rows.some((r) => r.id === cid)) pickId = cid;
    }
    if (pickId !== undefined) setActiveConversationId(pickId);
    return rows;
  }, [company]);

  useEffect(() => {
    let cancelled = false;
    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setSlowConvLoad(true);
    }, 8000);

    void (async () => {
      try {
        await loadConversations();
      } catch (e) {
        if (!cancelled) {
          setConvLoadError(
            e instanceof Error
              ? e.message
              : "Gesprekken laden mislukt — vernieuw de pagina."
          );
        }
      } finally {
        window.clearTimeout(slowTimer);
        if (!cancelled) setSlowConvLoad(false);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
    };
  }, [loadConversations]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("plan") === "1") {
      useLayoutStore.getState().setPlanMode(true);
    }
  }, []);

  useEffect(() => {
    if (layout !== "split" || activeConversationId === undefined) return;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    params.set("c", String(activeConversationId));
    if (planMode) params.set("plan", "1");
    else params.delete("plan");
    const path = `${window.location.pathname}?${params.toString()}`;
    if (`${window.location.pathname}?${window.location.search}` !== path) {
      router.replace(path, { scroll: false });
    }
  }, [activeConversationId, layout, planMode, router]);

  useEffect(() => {
    if (workspace !== "fumero") return;
    setFumeroModelTier(readStoredFumeroModelTier());
    setEnabledConnectors(readEnabledConnectors());
  }, [workspace]);

  /** Fumero: Turbo niet standaard — alleen expliciete toggle (niet uit persist). */
  useEffect(() => {
    if (workspace !== "fumero") return;
    if (motorChatMode === "motor_pro") {
      setMotorChatMode("motor");
    }
    setFumeroTurboOn(false);
  }, [workspace, setMotorChatMode]);

  const effectiveAgentMode =
    workspace === "fumero" && maxCompanion ? fumeroTurboOn : agentMode;

  const chatSendOpts = useMemo(
    () => ({
      agentMode: effectiveAgentMode,
      planMode,
      modelTier: workspace === "fumero" ? fumeroModelTier : undefined,
    }),
    [effectiveAgentMode, planMode, workspace, fumeroModelTier]
  );

  const {
    messages,
    send,
    appendUserMessage,
    prependAssistantMessage,
    appendAssistantMessage,
    updateMessage,
    regenerate,
    stop,
    streamingId,
    streamStatus,
    streamActivities,
    error,
    historyLoaded,
    clearError,
    reportError,
  } = useMotorsChat(company, undefined, activeConversationId, {
    onStreamComplete: () => void refreshConversations(),
  });

  const [text, setText] = useState("");
  const [artifactErr, setArtifactErr] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [composerDragOver, setComposerDragOver] = useState(false);
  const [uploadNotice, setUploadNotice] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);
  const [buildStatus, setBuildStatus] = useState<string | null>(null);
  const setBuildStatusUnlessCoder = useCallback(
    (label: string | null) => {
      if (label && fumeroCoderMode) return;
      setBuildStatus(label);
    },
    [fumeroCoderMode]
  );
  const [toolBusy, setToolBusy] = useState(false);
  const toolBuildAbortRef = useRef<AbortController | null>(null);
  const toolBuildPhaseMaxRef = useRef(0);
  const lastToolBuildRef = useRef<{ userText: string; seedOverride?: string } | null>(
    null
  );
  const [fumeroPrepStatus, setFumeroPrepStatus] = useState<string | null>(null);
  const [fumeroPrepActivities, setFumeroPrepActivities] = useState<string[]>([]);
  const [fumeroStuckHint, setFumeroStuckHint] = useState<string | null>(null);
  const [fumeroSubmitting, setFumeroSubmitting] = useState(false);
  const prepStepAtRef = useRef(Date.now());
  const lastPrepStepRef = useRef("");
  const fumeroPrepActivitiesRef = useRef<string[]>([]);
  const pendingSubmitRef = useRef<string | null>(null);
  const [coderBuildPhase, setCoderBuildPhase] = useState<string>(
    CODER_BUILD_PHASES[0]
  );
  const [coderPlanHintDismissed, setCoderPlanHintDismissed] = useState(false);
  const [publishModal, setPublishModal] =
    useState<FumeroPublishModalPayload | null>(null);
  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [visualEditMode, setVisualEditMode] = useState(false);
  const [activeToolId, setActiveToolId] = useState<number | null>(null);
  const [activeToolPrompt, setActiveToolPrompt] = useState("");
  const [awaitingToolTemplate, setAwaitingToolTemplate] = useState(false);
  const [activeToolCardMsgId, setActiveToolCardMsgId] = useState<string | null>(
    null
  );
  const [activeAppSlug, setActiveAppSlug] = useState<string | null>(null);
  const [activeAppCardMsgId, setActiveAppCardMsgId] = useState<string | null>(null);
  const [fumeroBuilderLabel, setFumeroBuilderLabel] = useState<string>("Max");

  const livePreviewRef = useRef<FumeroLivePreviewPayload | null>(null);
  const setLivePreview = useCallback(
    (preview: FumeroLivePreviewPayload | null) => {
      livePreviewRef.current = preview;
      onFumeroLivePreview?.(preview);
    },
    [onFumeroLivePreview]
  );

  const applyToolBuildProgress = useCallback(
    (update: ToolGenerationProgress) => {
      const label = update.message || update.phase || "";
      const { phase, index } = monotonicCoderBuildPhase(
        toolBuildPhaseMaxRef.current,
        label,
        { building: true }
      );
      toolBuildPhaseMaxRef.current = index;
      setCoderBuildPhase(phase);
      if (livePreviewRef.current?.building) {
        setLivePreview({
          ...livePreviewRef.current,
          building: true,
          buildPhase: phase,
          buildProgressPct: update.progressPct,
          buildElapsedMs: update.elapsedMs,
          status: livePreviewRef.current.previewUrl ? "ready" : "generating",
        });
      }
    },
    [setLivePreview]
  );

  useEffect(() => {
    return () => {
      toolBuildAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!toolBusy || !fumeroCoderMode) {
      if (!toolBusy && livePreviewRef.current?.building) {
        setLivePreview({
          ...livePreviewRef.current,
          building: false,
          buildPhase: undefined,
          buildProgressPct: undefined,
          buildElapsedMs: undefined,
        });
      }
      if (!toolBusy) {
        toolBuildPhaseMaxRef.current = 0;
        setCoderBuildPhase(CODER_BUILD_PHASES[0]);
      }
      return;
    }
    // Langzame fallback als polling even stilvalt — nooit terug springen.
    const id = window.setInterval(() => {
      const nextIndex = Math.min(
        CODER_BUILD_PHASES.length - 1,
        toolBuildPhaseMaxRef.current + 1
      );
      if (nextIndex <= toolBuildPhaseMaxRef.current) return;
      toolBuildPhaseMaxRef.current = nextIndex;
      const phase = CODER_BUILD_PHASES[nextIndex]!;
      setCoderBuildPhase(phase);
      if (livePreviewRef.current?.building) {
        setLivePreview({
          ...livePreviewRef.current,
          buildPhase: phase,
        });
      }
    }, 12_000);
    return () => window.clearInterval(id);
  }, [toolBusy, fumeroCoderMode, setLivePreview]);

  const agentReadiness = useAgentReadiness(effectiveAgentMode);
  const [listening, setListening] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (workspace !== "fumero" || !maxCompanion) return;
    void fetchJsonOptional<{ label?: string }>("/api/fumero/builder-config", {
      credentials: "include",
    }).then((j) => {
      if (j?.label) setFumeroBuilderLabel(j.label);
    });
  }, [workspace, maxCompanion]);

  const filteredConversations = useMemo(() => {
    const q = threadSearch.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, threadSearch]);

  const fumeroThreadGroups = useMemo(() => {
    if (workspace !== "fumero" || !maxCompanion) return null;
    return groupFumeroChatThreads(filteredConversations, 3);
  }, [workspace, maxCompanion, filteredConversations]);

  const scrollBottom = useCallback((smooth: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  const onMessagesScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const dist = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = dist < 96;
  }, []);

  useEffect(() => {
    if (stickToBottomRef.current) {
      scrollBottom(true);
    }
  }, [messages, streamingId, streamStatus, streamActivities, scrollBottom]);

  const pushFumeroPrepStep = useCallback((label: string) => {
    const step = label.trim();
    if (!step) return;
    prepStepAtRef.current = Date.now();
    lastPrepStepRef.current = step;
    setFumeroStuckHint(null);
    setFumeroPrepActivities((prev) => {
      if (prev[prev.length - 1] === step) return prev;
      const next = [...prev, step];
      fumeroPrepActivitiesRef.current = next;
      return next;
    });
    setFumeroPrepStatus(step);
  }, []);

  const resetFumeroPrep = useCallback(() => {
    fumeroPrepActivitiesRef.current = [];
    setFumeroPrepActivities([]);
    setFumeroPrepStatus(null);
    setFumeroStuckHint(null);
  }, []);

  useEffect(() => {
    if (!fumeroPrepStatus && !streamingId) {
      setFumeroStuckHint(null);
      return;
    }
    const tick = window.setInterval(() => {
      if (Date.now() - prepStepAtRef.current > 45_000) {
        setFumeroStuckHint(
          fumeroStuckHintLabel(
            lastPrepStepRef.current ||
              fumeroPrepStatus ||
              streamStatus ||
              "bezig"
          )
        );
      }
    }, 5000);
    return () => window.clearInterval(tick);
  }, [fumeroPrepStatus, streamingId, streamStatus]);

  useEffect(() => {
    if (streamStatus?.trim()) {
      prepStepAtRef.current = Date.now();
      lastPrepStepRef.current = streamStatus;
      setFumeroStuckHint(null);
    }
  }, [streamStatus]);

  useEffect(() => {
    if (fumeroPrepStatus) scrollBottom(true);
  }, [fumeroPrepStatus, fumeroPrepActivities, scrollBottom]);

  const resizeComposer = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, []);

  useEffect(() => {
    resizeComposer();
  }, [text, resizeComposer]);

  const newChat = async () => {
    if (streamingId) return;
    let row: ConversationRow;
    try {
      row = await fetchJsonChecked<ConversationRow>("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ klant: company }),
      });
    } catch {
      return;
    }
    setConversations((prev) => [row, ...prev]);
    setActiveConversationId(row.id);
  };

  useEffect(() => {
    if (workspace !== "fumero") return;

    const onNewChat = () => {
      void newChat();
    };
    const onFocusComposer = (e: Event) => {
      const detail = (e as CustomEvent<FumeroCmdFocusComposerDetail>).detail;
      if (detail?.prompt) setText(detail.prompt);
      textareaRef.current?.focus();
    };
    const onSetMode = (e: Event) => {
      const detail = (e as CustomEvent<FumeroCmdSetComposerModeDetail>).detail;
      if (!detail?.mode) return;
      setFumeroComposerMode(detail.mode);
      if (detail.prompt) setText(detail.prompt);
      requestAnimationFrame(() => textareaRef.current?.focus());
    };
    const onOpenConnectors = () => setConnectorsOpen(true);
    const onCycleTier = () => {
      setFumeroModelTier((prev) => {
        const order: FumeroComposerModelTier[] = ["flash", "normaal", "pro"];
        const idx = order.indexOf(prev);
        const next = order[(idx + 1) % order.length]!;
        writeStoredFumeroModelTier(next);
        const label = FUMERO_MODEL_TIERS.find((t) => t.id === next)?.label ?? next;
        showFumeroToast(`Antwoordsnelheid: ${label}`);
        return next;
      });
    };

    window.addEventListener(FUMERO_CMD_EVENTS.newChat, onNewChat);
    window.addEventListener(FUMERO_CMD_EVENTS.focusComposer, onFocusComposer);
    window.addEventListener(FUMERO_CMD_EVENTS.setComposerMode, onSetMode);
    window.addEventListener(FUMERO_CMD_EVENTS.openConnectors, onOpenConnectors);
    window.addEventListener(FUMERO_CMD_EVENTS.cycleModelTier, onCycleTier);

    return () => {
      window.removeEventListener(FUMERO_CMD_EVENTS.newChat, onNewChat);
      window.removeEventListener(FUMERO_CMD_EVENTS.focusComposer, onFocusComposer);
      window.removeEventListener(FUMERO_CMD_EVENTS.setComposerMode, onSetMode);
      window.removeEventListener(FUMERO_CMD_EVENTS.openConnectors, onOpenConnectors);
      window.removeEventListener(FUMERO_CMD_EVENTS.cycleModelTier, onCycleTier);
    };
  }, [workspace, streamingId, company]);

  const deleteConversation = async (id: number) => {
    if (streamingId) return;
    const res = await fetch(
      `/api/conversations/${id}?klant=${encodeURIComponent(company)}`,
      { method: "DELETE" }
    );
    if (!res.ok) return;
    const remaining = conversations.filter((c) => c.id !== id);
    setConversations(remaining);
    if (activeConversationId === id) {
      if (remaining[0]) {
        setActiveConversationId(remaining[0].id);
      } else {
        try {
          const row = await fetchJsonChecked<ConversationRow>("/api/conversations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ klant: company }),
          });
          setConversations([row]);
          setActiveConversationId(row.id);
        } catch {
          setActiveConversationId(undefined);
        }
      }
    }
  };

  const renameConversation = async (id: number, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const res = await fetch(
      `/api/conversations/${id}?klant=${encodeURIComponent(company)}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: trimmed }),
      }
    );
    if (!res.ok) return;
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c))
    );
    setEditingId(null);
  };

  const maybeAutoTitleConversation = useCallback(
    async (userText: string) => {
      if (activeConversationId === undefined) return;
      const conv = conversations.find((c) => c.id === activeConversationId);
      if (!conv || conv.title !== "Nieuwe chat") return;
      const title = deriveConversationTitleFromMessage(userText);
      if (!title || title === "Nieuwe chat") return;
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConversationId ? { ...c, title } : c))
      );
      try {
        await fetch(
          `/api/conversations/${activeConversationId}?klant=${encodeURIComponent(company)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ title }),
          }
        );
      } catch {
        /* ignore */
      }
    },
    [activeConversationId, conversations, company]
  );

  const ensureChatReady = useCallback(() => {
    if (activeConversationId === undefined) {
      reportError("Even geduld — gesprek wordt geladen…");
      return false;
    }
    return true;
  }, [activeConversationId, reportError]);

  const detailToToolCard = useCallback(
    (
      detail: Awaited<ReturnType<typeof fetchToolDetail>>,
      status: FumeroToolCardPayload["status"] = "concept",
      previewEpoch?: number
    ): FumeroToolCardPayload => ({
      toolId: detail.tool.id,
      name: detail.tool.name,
      slug: detail.tool.slug,
      previewUrl: cacheBustPreviewUrl(detail.preview_url, previewEpoch),
      deployType: detail.tool.deploy_type,
      status,
      embedCode: detail.embed_code,
      internalUrl: detail.internal_url,
      basePrompt: detail.concept?.prompt ?? undefined,
      version: detail.concept?.version ?? detail.published?.version,
      previewEpoch,
      builderLabel: fumeroBuilderLabel,
      statsViews: detail.stats_views,
      statsInteractions: detail.stats_interactions,
    }),
    [fumeroBuilderLabel]
  );

  const appDetailToCard = useCallback(
    (
      detail: AppDetail,
      status: AppCardPayload["status"] = "concept",
      previewEpoch?: number
    ): AppCardPayload => {
      let tables = 0;
      if (detail.db_schema) {
        try {
          const s = JSON.parse(detail.db_schema);
          if (Array.isArray(s?.tables)) tables = s.tables.length;
        } catch {}
      }
      return {
        slug: detail.slug,
        name: detail.naam,
        type: detail.type,
        version: detail.version,
        status,
        previewUrl: cacheBustPreviewUrl(
          normalizeMotorPublicUrl(
            detail.preview_url ?? fullAppPreviewUrl(detail.slug)
          ),
          previewEpoch
        ),
        embedCode: detail.embed_code,
        internalUrl: detail.internal_url,
        tables,
        authRequired: !!detail.auth_required,
        hasPwa: true,
        previewEpoch,
        builderLabel: fumeroBuilderLabel,
      };
    },
    [fumeroBuilderLabel]
  );

  const showToolTemplatePicker = useCallback(
    (seedPrompt: string) => {
      setAwaitingToolTemplate(true);
      setActiveToolPrompt(seedPrompt);
      appendAssistantMessage(toolIntentAssistantIntro(), {
        toolQuickReplies: FUMERO_TOOL_QUICK_REPLIES,
      });
    },
    [appendAssistantMessage]
  );

  const runToolBuild = useCallback(
    async (userText: string, seedOverride?: string) => {
      if (toolBusy) return;
      lastToolBuildRef.current = { userText, seedOverride };
      toolBuildAbortRef.current?.abort();
      const abort = new AbortController();
      toolBuildAbortRef.current = abort;
      toolBuildPhaseMaxRef.current = 0;

      setFumeroPrepStatus(null);
      setFumeroSubmitting(false);
      setFumeroPrepActivities([]);
      fumeroPrepActivitiesRef.current = [];

      const seed = (seedOverride ?? activeToolPrompt ?? userText).trim();
      const quick = resolveTemplateFromQuickReply(userText);
      const tplFromText =
        resolveTemplateFromUserText(userText) ??
        resolveTemplateFromUserText(seed);
      const templateId =
        quick?.templateId && quick.templateId !== "custom"
          ? quick.templateId
          : tplFromText;
      const deployType = deployTypeForTemplate(templateId);
      const seedLine = templateId ? getTemplate(templateId)?.promptSeed : undefined;
      let merged = buildInitialToolPrompt(
        seed,
        enrichCasualBouwenPrompt(userText),
        seedLine
      );
      const name = deriveToolName(seed || userText, templateId);

      setAwaitingToolTemplate(false);
      writePendingBouwenClarify(null);
      setToolBusy(true);
      setCoderBuildPhase(CODER_BUILD_PHASES[0]);
      const instantPreview = templateId
        ? templatePreviewDataUrl({
            templateId,
            name,
            prompt: merged,
            deployType,
          })
        : null;
      setLivePreview({
        title: name,
        previewUrl: instantPreview,
        status: "generating",
        version: 1,
        building: true,
        buildPhase: CODER_BUILD_PHASES[0],
        buildProgressPct: 4,
        buildElapsedMs: 0,
        runtime: "html",
      });
      setPreviewPanelOpen(true);
      onFumeroContentPreview?.(null);

      const cardMsgId = appendAssistantMessage("Bezig met bouwen…", {
        toolCard: {
          toolId: 0,
          name,
          previewUrl: instantPreview,
          deployType,
          status: "generating",
          basePrompt: merged,
          version: 1,
          builderLabel: fumeroBuilderLabel,
        },
      });
      setActiveToolCardMsgId(cardMsgId);

      let scrapeNotice: string | null = null;
      if (workspace === "fumero") {
        applyToolBuildProgress({
          phase: "analyzing",
          message: "Live info ophalen…",
          status: "running",
          progressPct: 12,
        });
        try {
          const scrapeCtx = await buildScrapeContextForToolBuild(userText, "fumero");
          if (scrapeCtx?.block) {
            merged = `${scrapeCtx.block}\n\n${merged}`;
            const pages = scrapeCtx.urls.length;
            scrapeNotice =
              pages > 1
                ? `Ik heb **${pages} pagina's** van fumero.nl uitgelezen — die info gebruik ik in je chatbot.`
                : `Ik heb **fumero.nl** uitgelezen — die info gebruik ik in je chatbot.`;
            if (scrapeCtx.errors.length) {
              scrapeNotice += `\n\n_Niet alle pagina's gelukt: ${scrapeCtx.errors.slice(0, 2).join("; ")}_`;
            }
          }
        } catch {
          /* bouwen gaat door zonder scrape */
        }
      }

      if (enabledConnectors.includes("designer")) {
        merged = applyDesignerHints(merged, templateId);
      }

      if (scrapeNotice) {
        updateMessage(cardMsgId, { content: scrapeNotice });
      }

      try {
        const { tool_id } = await createFumeroTool(
          {
            name,
            prompt: merged,
            deploy_type: deployType,
            template_id: templateId,
          },
          {
            signal: abort.signal,
            onProgress: applyToolBuildProgress,
          }
        );
        const detail = await fetchToolDetail(tool_id);
        setActiveToolId(tool_id);
        setActiveToolPrompt(detail.concept?.prompt ?? merged);
        const card = detailToToolCard(detail, "concept", Date.now());

        setLivePreview({
          title: detail.tool.name,
          previewUrl: card.previewUrl,
          status: "generating",
          previewEpoch: card.previewEpoch,
          version: card.version,
          building: true,
          buildPhase: CODER_BUILD_PHASES[CODER_BUILD_PHASES.length - 1],
          buildProgressPct: 100,
          buildSuccessFlash: true,
          embedCode: card.embedCode ?? null,
          runtime: runtimeFromDeployType(card.deployType),
          uxReviewAvailable: true,
          interactive: false,
        });

        await new Promise((r) => setTimeout(r, 650));

        setLivePreview({
          title: detail.tool.name,
          previewUrl: card.previewUrl,
          status: "ready",
          previewEpoch: card.previewEpoch,
          version: card.version,
          building: false,
          buildPhase: undefined,
          buildProgressPct: undefined,
          buildElapsedMs: undefined,
          buildSuccessFlash: false,
          embedCode: card.embedCode ?? null,
          runtime: runtimeFromDeployType(card.deployType),
          uxReviewAvailable: true,
          interactive: true,
        });
        setPreviewPanelOpen(true);
        updateMessage(cardMsgId, {
          content: fumeroCoderMode
            ? `**${detail.tool.name}** staat klaar. Bekijk de live preview rechts — verfijn in chat of deploy naar de garage.`
            : "Hier is je concept. Verfijn via **Pas aan** of in chat — daarna **Deploy** naar de garage.",
          toolCard: card,
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const msg = formatFumeroBuilderError(
          err instanceof Error ? err.message : "Genereren mislukt"
        );
        setArtifactErr(msg);
        setLivePreview({
          title: name,
          previewUrl: instantPreview,
          status: "generating",
          version: 1,
          building: false,
          buildPhase: undefined,
          buildProgressPct: undefined,
          buildElapsedMs: undefined,
          runtime: "html",
        });
        updateMessage(cardMsgId, {
          content: `**Genereren mislukt.** ${msg}\n\nJe prompt blijft bewaard — probeer opnieuw.`,
          toolCard: {
            toolId: 0,
            name,
            previewUrl: instantPreview,
            deployType,
            status: "concept",
            basePrompt: merged,
            version: 1,
            builderLabel: fumeroBuilderLabel,
          },
          toolQuickReplies: [{ label: "Opnieuw proberen", prompt: userText }],
        });
      } finally {
        if (toolBuildAbortRef.current === abort) {
          toolBuildAbortRef.current = null;
        }
        setToolBusy(false);
        setBuildStatus(null);
        scrollBottom(true);
      }
    },
    [
      activeToolPrompt,
      appendAssistantMessage,
      applyToolBuildProgress,
      detailToToolCard,
      enabledConnectors,
      fumeroBuilderLabel,
      fumeroCoderMode,
      layout,
      onFumeroContentPreview,
      scrollBottom,
      setPreviewPanelOpen,
      toolBusy,
      updateMessage,
      workspace,
    ]
  );

  const runUxReview = useCallback(async () => {
    const previewRuntime = livePreviewRef.current?.runtime;
    if (previewRuntime === "full_app") {
      appendAssistantMessage(
        "**UX-check** is nu beschikbaar voor HTML-tools en widgets. Voor interne team-apps test je het beste direct in de preview — een AI-gestuurde UX-review voor full-stack apps komt in een volgende release."
      );
      scrollBottom(true);
      return;
    }
    if (previewRuntime === "react") {
      appendAssistantMessage(
        "**UX-check** werkt voor losse HTML-tools. Voor multi-file websites en apps bekijk je de preview en geef feedback in chat — geautomatiseerde UX-review volgt later."
      );
      scrollBottom(true);
      return;
    }
    if (!activeToolId) {
      appendAssistantMessage(
        "Bouw eerst een tool in **Bouwen** — daarna kan ik een UX-check draaien op de HTML-preview."
      );
      scrollBottom(true);
      return;
    }
    const reviewMsgId = appendAssistantMessage("UX-check wordt uitgevoerd…");
    try {
      const res = await fetch("/api/fumero/ux-review", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toolId: activeToolId,
          llm: enabledConnectors.includes("ux_review"),
        }),
      });
      const data = (await res.json()) as { markdown?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "UX-check mislukt");
      }
      updateMessage(reviewMsgId, {
        content: data.markdown ?? "UX-check afgerond.",
      });
    } catch (err) {
      updateMessage(reviewMsgId, {
        content: `**UX-check mislukt.** ${formatFumeroBuilderError(
          err instanceof Error ? err.message : "Onbekende fout"
        )}`,
      });
    }
    scrollBottom(true);
  }, [
    activeToolId,
    appendAssistantMessage,
    enabledConnectors,
    scrollBottom,
    updateMessage,
  ]);

  const runToolIterate = useCallback(
    async (instruction: string) => {
      if (!activeToolId || toolBusy) return;
      toolBuildAbortRef.current?.abort();
      const abort = new AbortController();
      toolBuildAbortRef.current = abort;
      toolBuildPhaseMaxRef.current = 0;

      setFumeroPrepStatus(null);
      setFumeroSubmitting(false);
      setToolBusy(true);
      const merged = mergeToolPrompt(activeToolPrompt, instruction);
      const withDesign =
        enabledConnectors.includes("designer")
          ? applyDesignerHints(merged, undefined)
          : merged;
      const previewEpoch = Date.now();
      const prevCard = messages.find((m) => m.id === activeToolCardMsgId)?.toolCard;
      const nextVersion = (prevCard?.version ?? 1) + 1;
      showFumeroToast(`Versie ${nextVersion} wordt gebouwd…`);
      setPreviewPanelOpen(true);
      setCoderBuildPhase(CODER_BUILD_PHASES[0]);
      setLivePreview({
        title: prevCard?.name ?? "Preview",
        previewUrl: prevCard?.previewUrl ?? null,
        status: "generating",
        previewEpoch,
        version: nextVersion,
        building: true,
        buildPhase: CODER_BUILD_PHASES[0],
        buildProgressPct: 4,
        buildElapsedMs: 0,
      });
      if (activeToolCardMsgId && prevCard) {
        updateMessage(activeToolCardMsgId, {
          toolCard: {
            ...prevCard,
            status: "generating",
            previewEpoch,
            version: nextVersion,
            builderLabel: fumeroBuilderLabel,
          },
        });
      }
      try {
        await iterateFumeroTool(activeToolId, withDesign, {
          signal: abort.signal,
          onProgress: applyToolBuildProgress,
        });
        const detail = await fetchToolDetail(activeToolId);
        setActiveToolPrompt(detail.concept?.prompt ?? withDesign);
        const card = detailToToolCard(detail, "concept", previewEpoch);

        setLivePreview({
          title: detail.tool.name,
          previewUrl: card.previewUrl,
          status: "generating",
          previewEpoch,
          version: card.version,
          building: true,
          buildPhase: CODER_BUILD_PHASES[CODER_BUILD_PHASES.length - 1],
          buildProgressPct: 100,
          buildSuccessFlash: true,
          embedCode: card.embedCode ?? null,
          interactive: false,
        });

        await new Promise((r) => setTimeout(r, 650));

        setLivePreview({
          title: detail.tool.name,
          previewUrl: card.previewUrl,
          status: "ready",
          previewEpoch,
          version: card.version,
          building: false,
          buildPhase: undefined,
          buildProgressPct: undefined,
          buildElapsedMs: undefined,
          buildSuccessFlash: false,
          embedCode: card.embedCode ?? null,
          interactive: true,
        });
        const versionNote =
          detail.concept?.version != null
            ? ` (${fumeroConceptVersionLabel(detail.concept.version)})`
            : "";
        if (activeToolCardMsgId) {
          updateMessage(activeToolCardMsgId, {
            content: `Concept bijgewerkt${versionNote}. Nog een aanpassing, of **Deploy naar garage** als je klaar bent.`,
            toolCard: card,
          });
        } else {
          appendAssistantMessage(`Concept bijgewerkt${versionNote}.`, { toolCard: card });
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const msg = formatFumeroBuilderError(
          err instanceof Error ? err.message : "Aanpassen mislukt"
        );
        setArtifactErr(msg);
        if (activeToolCardMsgId && prevCard) {
          updateMessage(activeToolCardMsgId, {
            content: `**Verfijnen mislukt.** ${msg}`,
            toolCard: { ...prevCard, status: "concept" },
            toolQuickReplies: [{ label: "Opnieuw proberen", prompt: instruction }],
          });
        }
      } finally {
        if (toolBuildAbortRef.current === abort) {
          toolBuildAbortRef.current = null;
        }
        setToolBusy(false);
        setBuildStatus(null);
        scrollBottom(true);
      }
    },
    [
      activeToolCardMsgId,
      activeToolId,
      activeToolPrompt,
      appendAssistantMessage,
      applyToolBuildProgress,
      detailToToolCard,
      enabledConnectors,
      fumeroBuilderLabel,
      messages,
      scrollBottom,
      setPreviewPanelOpen,
      toolBusy,
      updateMessage,
    ]
  );

  const runToolPublish = useCallback(async () => {
    if (!activeToolId) return;
    setToolBusy(true);
    setBuildStatusUnlessCoder("Publiceren…");
    try {
      const detail = await publishFumeroTool(activeToolId);
      const card = detailToToolCard(detail, "published");
      const publishedVersion =
        card.version ?? detail.published?.version ?? detail.concept?.version ?? 1;
      showFumeroToast(`Live — v${publishedVersion} gepubliceerd`);
      if (activeToolCardMsgId) {
        updateMessage(activeToolCardMsgId, {
          content: `**Live in Projecten** — v${publishedVersion} gepubliceerd. Open in Projecten of kopieer embed hieronder.`,
          toolCard: card,
        });
      }
      const liveUrl = normalizeMotorPublicUrl(
        card.internalUrl ??
          (card.slug && card.deployType === "widget"
            ? `${motorPublicOrigin()}/embed/fumero/widget/${card.slug}`
            : card.slug && card.deployType === "customer"
              ? `${motorPublicOrigin()}/embed/fumero/app/${card.slug}`
              : card.slug && card.deployType === "internal"
                ? `${motorPublicOrigin()}/apps/${card.slug}`
                : null)
      );
      const publishPayload: FumeroPublishModalPayload = {
        name: detail.tool.name,
        liveUrl,
        embedCode: card.embedCode ?? null,
        slug: detail.tool.slug,
        toolId: detail.tool.id,
        version: publishedVersion,
      };
      if (onPublishSuccess) {
        onPublishSuccess(publishPayload);
      } else {
        setPublishModal(publishPayload);
        setPublishModalOpen(true);
      }
      appendAssistantMessage(formatToolDeployedMarkdown(detail.tool.name, liveUrl), {
        toolCard: card,
      });
    } catch (err) {
      setArtifactErr(err instanceof Error ? err.message : "Publiceren mislukt");
    } finally {
      setToolBusy(false);
      setBuildStatus(null);
      scrollBottom(true);
    }
  }, [
    activeToolCardMsgId,
    activeToolId,
    appendAssistantMessage,
    detailToToolCard,
    onPublishSuccess,
    scrollBottom,
    updateMessage,
  ]);

  useEffect(() => {
    onRegisterUxReview?.(runUxReview);
  }, [onRegisterUxReview, runUxReview]);

  // Fase 5 full-app handlers (Lovable UX in chat card, data preserved on refine)
  const runFullAppBuild = useCallback(
    async (userText: string) => {
      setFumeroPrepStatus(null);
      setFumeroSubmitting(false);
      const seed = userText.trim();
      const nameGuess = seed.slice(0, 48) || "Nieuwe App";
      setToolBusy(true);
      setBuildStatusUnlessCoder("App genereren (full-stack)…");
      setLivePreview({
        title: nameGuess,
        previewUrl: null,
        status: "generating",
        runtime: "full_app",
      });
      onFumeroContentPreview?.(null);

      const cardMsgId = appendAssistantMessage(
        "Ik bouw je volledige data-gedreven app — even geduld.",
        {
          appCard: {
            slug: "",
            name: nameGuess,
            type: "internal",
            version: 1,
            status: "generating",
            previewUrl: null,
            builderLabel: fumeroBuilderLabel,
          } as AppCardPayload,
        }
      );
      setActiveAppCardMsgId(cardMsgId);

      try {
        const { slug, naam } = await createFullApp(seed);
        const detail = await fetchAppDetail(slug);
        setActiveAppSlug(slug);
        const card = appDetailToCard(detail, "concept", Date.now());
        setLivePreview({
          title: detail.naam,
          previewUrl: card.previewUrl,
          status: "ready",
          previewEpoch: card.previewEpoch,
          runtime: "full_app",
        });
        updateMessage(cardMsgId, {
          content:
            `**Volledige app gegenereerd:** **${naam}**\n\nSlug: \`${slug}\` • Data API: \`/api/apps/${slug}/data\`\n\nVerfijn met **Pas aan** (data blijft intact) of **Deploy** voor live URL.`,
          appCard: card,
        });
      } catch (err) {
        const msg = formatFumeroBuilderError(
          err instanceof Error ? err.message : "Full-app generatie mislukt"
        );
        setArtifactErr(msg);
        updateMessage(cardMsgId, {
          content: `**App genereren mislukt.** ${msg}`,
          appCard: undefined,
        });
      } finally {
        setToolBusy(false);
        setBuildStatus(null);
        scrollBottom(true);
      }
    },
    [appendAssistantMessage, appDetailToCard, fumeroBuilderLabel, onFumeroContentPreview, onFumeroLivePreview, scrollBottom, updateMessage]
  );

  const runAppIterate = useCallback(
    async (instruction: string) => {
      if (!activeAppSlug) return;
      setToolBusy(true);
      setBuildStatusUnlessCoder("App verfijnen (data behouden)…");
      const previewEpoch = Date.now();
      const prevCard = messages.find((m) => m.id === activeAppCardMsgId)?.appCard;
      setLivePreview({
        title: prevCard?.name ?? "App",
        previewUrl: prevCard?.previewUrl ?? null,
        status: "generating",
        previewEpoch,
        runtime: "full_app",
      });
      if (activeAppCardMsgId && prevCard) {
        updateMessage(activeAppCardMsgId, {
          appCard: {
            ...prevCard,
            status: "generating",
            previewEpoch,
            builderLabel: fumeroBuilderLabel,
          },
        });
      }
      try {
        await iterateFullApp(activeAppSlug, instruction);
        const detail = await fetchAppDetail(activeAppSlug);
        const card = appDetailToCard(detail, "concept", previewEpoch);
        setLivePreview({
          title: detail.naam,
          previewUrl: card.previewUrl,
          status: "ready",
          previewEpoch,
          runtime: "full_app",
        });
        const versionNote = detail.version
          ? ` (${fumeroConceptVersionLabel(detail.version)})`
          : "";
        if (activeAppCardMsgId) {
          updateMessage(activeAppCardMsgId, {
            content: `App bijgewerkt${versionNote} — bestaande data intact. Nog een aanpassing of Deploy.`,
            appCard: card,
          });
        } else {
          appendAssistantMessage(`App bijgewerkt${versionNote}.`, { appCard: card });
        }
      } catch (err) {
        const msg = formatFumeroBuilderError(
          err instanceof Error ? err.message : "App verfijnen mislukt"
        );
        setArtifactErr(msg);
        if (activeAppCardMsgId && prevCard) {
          updateMessage(activeAppCardMsgId, {
            content: `**Verfijnen mislukt.** ${msg}`,
            appCard: { ...prevCard, status: "concept" },
          });
        }
      } finally {
        setToolBusy(false);
        setBuildStatus(null);
        scrollBottom(true);
      }
    },
    [
      activeAppCardMsgId,
      activeAppSlug,
      appendAssistantMessage,
      appDetailToCard,
      fumeroBuilderLabel,
      messages,
      onFumeroLivePreview,
      scrollBottom,
      updateMessage,
    ]
  );

  const runAppPublish = useCallback(async () => {
    if (!activeAppSlug) return;
    setToolBusy(true);
    setBuildStatusUnlessCoder("Publiceren…");
    try {
      const detail = await publishFullApp(activeAppSlug);
      const card = appDetailToCard(detail, "published");
      if (activeAppCardMsgId) {
        updateMessage(activeAppCardMsgId, { appCard: card });
      }
      const origin = motorPublicOrigin();
      const liveUrl =
        normalizeMotorPublicUrl(detail.internal_url) ??
        (detail.type === "internal"
          ? `${origin}/apps/${detail.slug}`
          : detail.type === "customer"
            ? `${origin}/embed/fumero/app/${detail.slug}`
            : null);
      const publishPayload: FumeroPublishModalPayload = {
        name: detail.naam,
        liveUrl,
        embedCode: detail.embed_code ?? null,
        slug: detail.slug,
        version: detail.version,
      };
      if (onPublishSuccess) {
        onPublishSuccess(publishPayload);
      } else {
        setPublishModal(publishPayload);
        setPublishModalOpen(true);
      }
      const display = liveUrl ?? detail.slug;
      appendAssistantMessage(
        `**${detail.naam}** is live.\n\nURL: \`${display}\`\n\nEmbed-code staat in de app-kaart — kopieer met één klik.`,
        { appCard: card }
      );
    } catch (err) {
      setArtifactErr(err instanceof Error ? err.message : "Publiceren mislukt");
    } finally {
      setToolBusy(false);
      setBuildStatus(null);
      scrollBottom(true);
    }
  }, [
    activeAppCardMsgId,
    activeAppSlug,
    appendAssistantMessage,
    appDetailToCard,
    onPublishSuccess,
    scrollBottom,
    updateMessage,
  ]);

  const runToolPublishRef = useRef(runToolPublish);
  const runAppPublishRef = useRef(runAppPublish);
  const runUxReviewRef = useRef(runUxReview);
  runToolPublishRef.current = runToolPublish;
  runAppPublishRef.current = runAppPublish;
  runUxReviewRef.current = runUxReview;

  useEffect(() => {
    if (!onBouwenBridgeUpdate) return;
    const activeToolCard = messages.find((m) => m.id === activeToolCardMsgId)?.toolCard;
    const runtime =
      livePreviewRef.current?.runtime ??
      resolveActiveBouwenRuntime({
        activeToolId,
        activeAppSlug,
        toolDeployType: activeToolCard?.deployType ?? null,
        hasActiveProject,
        projectStack,
      });
    const saving =
      toolBusy ||
      fumeroSubmitting ||
      streamStatus === "streaming" ||
      streamStatus === "submitted";
    const buildActive =
      messages.length > 0 ||
      toolBusy ||
      fumeroSubmitting ||
      streamStatus === "streaming" ||
      streamStatus === "submitted" ||
      Boolean(livePreviewRef.current) ||
      Boolean(activeToolId) ||
      Boolean(activeAppSlug) ||
      hasActiveProject ||
      Boolean(initialToolId) ||
      Boolean(initialAppSlug) ||
      Boolean(initialPrompt?.trim());
    onBouwenBridgeUpdate({
      ...EMPTY_BOUWEN_BRIDGE,
      buildActive,
      activeToolId,
      activeAppSlug,
      canPublish: Boolean((activeToolId || activeAppSlug) && !toolBusy),
      canUxReview: Boolean(activeToolId && !toolBusy),
      toolBusy,
      livePreview: livePreviewRef.current,
      runtime,
      publish: async () => {
        if (activeAppSlug) await runAppPublishRef.current();
        else await runToolPublishRef.current();
      },
      runUxReview: () => runUxReviewRef.current(),
      toolSlug: activeToolCard?.slug ?? null,
      embedCode:
        livePreviewRef.current?.embedCode ??
        activeToolCard?.embedCode ??
        null,
      saveState: saving ? "saving" : historyLoaded ? "saved" : "unavailable",
      publishBusy: toolBusy,
      publishError: error,
      newChat,
      chatControlsDisabled: saving || activeConversationId === undefined,
      conversations: conversations.map((c) => ({
        id: c.id,
        title: c.title,
      })),
      activeConversationId,
      selectConversation: (id: number) => setActiveConversationId(id),
    });
  }, [
    activeToolId,
    activeAppSlug,
    activeToolCardMsgId,
    activeConversationId,
    conversations,
    error,
    fumeroSubmitting,
    hasActiveProject,
    historyLoaded,
    initialAppSlug,
    initialPrompt,
    initialToolId,
    messages,
    newChat,
    onBouwenBridgeUpdate,
    projectStack,
    streamStatus,
    toolBusy,
  ]);

  const openExistingAppInChat = useCallback(
    async (slug: string) => {
      setToolBusy(true);
      try {
        const detail = await fetchAppDetail(slug);
        setActiveAppSlug(slug);
        setActiveAppCardMsgId(null);
        const card = appDetailToCard(
          detail,
          detail.status === "published" ? "published" : "concept",
          Date.now()
        );
        const msgId = appendAssistantMessage(
          `**${detail.naam}** (v${detail.version}) — verder bouwen in deze thread. Pas aan via de kaart of chat (data blijft behouden).`,
          { appCard: card }
        );
        setLivePreview({
          title: detail.naam,
          previewUrl: card.previewUrl,
          status: "ready",
          previewEpoch: card.previewEpoch,
          runtime: "full_app",
        });
        setActiveAppCardMsgId(msgId);
      } catch (err) {
        setArtifactErr(err instanceof Error ? err.message : "App laden mislukt");
      } finally {
        setToolBusy(false);
        scrollBottom(true);
      }
    },
    [appendAssistantMessage, appDetailToCard, onFumeroLivePreview, scrollBottom]
  );

  const openExistingToolInChat = useCallback(
    async (toolId: number) => {
      setToolBusy(true);
      try {
        const detail = await fetchToolDetail(toolId);
        setActiveToolId(toolId);
        setActiveToolPrompt(detail.concept?.prompt ?? "");
        setAwaitingToolTemplate(false);
        setFumeroComposerMode("coder");
        setPreviewPanelOpen(true);
        const card = detailToToolCard(
          detail,
          detail.published && !detail.concept ? "published" : "concept",
          Date.now()
        );
        const msgId = appendAssistantMessage(
          `**${detail.tool.name}** — verder bouwen in deze thread. Pas aan via de kaart of chat.`,
          { toolCard: card }
        );
        setLivePreview({
          title: detail.tool.name,
          previewUrl: card.previewUrl,
          status: "ready",
          previewEpoch: card.previewEpoch,
          version: card.version,
          runtime: runtimeFromDeployType(card.deployType),
          uxReviewAvailable: true,
          interactive: true,
        });
        setActiveToolCardMsgId(msgId);
      } catch (err) {
        setArtifactErr(err instanceof Error ? err.message : "Tool laden mislukt");
      } finally {
        setToolBusy(false);
        scrollBottom(true);
      }
    },
    [appendAssistantMessage, detailToToolCard, onFumeroLivePreview, scrollBottom, setPreviewPanelOpen]
  );

  const runContentGenerate = useCallback(
    async (
      action: NonNullable<ReturnType<typeof resolveMaxContentChatAction>>,
      opts?: { canvasMode?: boolean }
    ) => {
      const canvasMode = Boolean(opts?.canvasMode);
      setArtifactErr(null);
      setToolBusy(true);
      setBuildStatusUnlessCoder(canvasMode ? "Schrijven genereren…" : "Content genereren…");
      onFumeroContentPreview?.({
        contentType: action.contentType,
        platform: action.platform,
        status: "generating",
        title: contentPreviewTitle(action.contentType, action.platform),
        canvasMode,
      });
      setLivePreview(null);
      try {
        const res = await fetch("/api/fumero/content/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            custom_prompt: action.prompt,
            content_type: action.contentType,
            platform: action.platform,
          }),
        });
        const data = (await res.json()) as {
          error?: string;
          id?: number;
          content?: string;
          media_kind?: string;
          media_url?: string;
          platform?: string;
          type?: string;
        };
        if (!res.ok) {
          throw new Error(data.error || "Content genereren mislukt");
        }
        const cleanContent =
          typeof data.content === "string"
            ? cleanGeneratedContent(data.content)
            : "";
        const mediaKind =
          data.media_kind === "image"
            ? "image"
            : data.media_kind === "script"
              ? "script"
              : "text";
        const mediaUrl =
          typeof data.media_url === "string" && data.media_url.trim()
            ? data.media_url.trim()
            : undefined;
        const postId = typeof data.id === "number" ? data.id : undefined;
        const platform = data.platform ?? action.platform;
        const contentType = data.type ?? action.contentType;

        onFumeroContentPreview?.({
          contentType,
          platform,
          content: cleanContent || undefined,
          mediaUrl,
          mediaKind,
          postId,
          status: "ready",
          title: contentPreviewTitle(contentType, platform),
          canvasMode,
        });

        const previewTitle = contentPreviewTitle(contentType, platform);
        appendAssistantMessage(
          formatContentSavedMarkdown({
            contentType,
            platform,
            postId,
            mediaKind,
          }),
          {
            contentCard: {
              mediaUrl,
              mediaKind,
              postId,
              contentType,
              platform,
              canvasMode,
              title: previewTitle,
              contentSnippet: cleanContent
                ? cleanContent.slice(0, 140).replace(/\s+/g, " ")
                : undefined,
              documentContent: canvasMode ? cleanContent || undefined : undefined,
            },
          }
        );
        if (canvasMode) {
          setPreviewPanelOpen(true);
        }
      } catch (err) {
        onFumeroContentPreview?.({
          contentType: action.contentType,
          platform: action.platform,
          status: "error",
          title: contentPreviewTitle(action.contentType, action.platform),
        });
        setArtifactErr(
          err instanceof Error ? err.message : "Content genereren mislukt"
        );
      } finally {
        setToolBusy(false);
        setBuildStatus(null);
        scrollBottom(true);
      }
    },
    [
      appendAssistantMessage,
      onFumeroContentPreview,
      onFumeroLivePreview,
      scrollBottom,
    ]
  );

  const sendFumeroMaxReply = useCallback(
    async (userText: string, buildIntent: boolean) => {
      setFumeroSubmitting(true);
      const first = fumeroPrepStatusLabel(userText);
      prepStepAtRef.current = Date.now();
      lastPrepStepRef.current = first;
      fumeroPrepActivitiesRef.current = [first];
      setFumeroPrepActivities([first]);
      setFumeroPrepStatus(first);
      clearError();
      try {
        pushFumeroPrepStep("Context samenstellen…");
        const augmented = await augmentPromptWithFumeroConnectors(
          userText,
          enabledConnectors,
          {
            onlineMode: fumeroComposerMode === "online",
            buildIntent,
            onProgress: pushFumeroPrepStep,
          }
        );
        const scrapeNotice = formatFumeroScrapeChatNotice(augmented.scrapeUrls);
        if (scrapeNotice) {
          appendAssistantMessage(scrapeNotice);
          scrollBottom(true);
        }
        pushFumeroPrepStep("Max · antwoord streamen…");
        await send(augmented.prompt, {
          ...chatSendOpts,
          skipUserMessage: true,
          initialActivities: [...fumeroPrepActivitiesRef.current],
        });
      } catch (e) {
        reportError(
          e instanceof Error ? e.message : "Kon Max-antwoord niet starten"
        );
      } finally {
        resetFumeroPrep();
        setFumeroSubmitting(false);
      }
    },
    [
      appendAssistantMessage,
      chatSendOpts,
      clearError,
      enabledConnectors,
      fumeroComposerMode,
      pushFumeroPrepStep,
      reportError,
      resetFumeroPrep,
      scrollBottom,
      send,
    ]
  );

  const submitText = useCallback(
    async (raw: string, opts?: { skipShowPrompt?: boolean }) => {
    const t = raw.trim();
    if (!t) return;
    if (streamingId) {
      reportError("Even wachten — Max is nog bezig met het vorige antwoord.");
      return;
    }
    if (fumeroPrepStatus) return;
    if (artifactBusy) {
      reportError("Even wachten — er loopt nog een andere taak.");
      return;
    }
    if (toolBusy) {
      reportError(
        "Even wachten — de build is nog bezig. Verstuur opnieuw zodra de preview klaar is."
      );
      return;
    }
    if (activeConversationId === undefined) {
      if (convLoadError) {
        reportError(convLoadError);
        return;
      }
      if (!opts?.skipShowPrompt) {
        appendUserMessage(t);
        setText("");
        scrollBottom(true);
      }
      pendingSubmitRef.current = t;
      setFumeroPrepStatus("Gesprek laden…");
      return;
    }
    if (!historyLoaded) {
      if (!opts?.skipShowPrompt) {
        appendUserMessage(t);
        setText("");
        scrollBottom(true);
      }
      pendingSubmitRef.current = t;
      setFumeroPrepStatus("Gesprek laden…");
      return;
    }
    if (!ensureChatReady()) return;
    stickToBottomRef.current = true;

    const showPromptInChat = () => {
      if (opts?.skipShowPrompt) return;
      const isFirstUser =
        messages.filter((m) => m.role === "user").length === 0;
      appendUserMessage(t);
      if (isFirstUser) void maybeAutoTitleConversation(t);
      setText("");
      scrollBottom(true);
    };

    if (workspace === "fumero") {
      const goalCmd = parseMaxGoalCommand(t);
      if (goalCmd) {
        showPromptInChat();
        try {
          const res = await fetch("/api/fumero/goal", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ klant: "fumero", command: t }),
          });
          const data = (await res.json()) as { reply?: string; error?: string };
          if (!res.ok) {
            throw new Error(data.error || "Doel kon niet worden opgeslagen");
          }
          appendAssistantMessage(
            typeof data.reply === "string" ? data.reply : "Doel bijgewerkt."
          );
          dispatchFumeroGoalUpdated();
        } catch (err) {
          reportError(
            err instanceof Error ? err.message : "Doel kon niet worden opgeslagen"
          );
        }
        scrollBottom(true);
        return;
      }

      const fetchFumeroGoals = async (): Promise<string | null> => {
        try {
          const res = await fetch("/api/fumero/goal?klant=fumero", {
            credentials: "include",
          });
          if (!res.ok) return null;
          const json = (await res.json()) as { goals?: string | null };
          return json.goals?.trim() || null;
        } catch {
          return null;
        }
      };

      const endFumeroActivity = () => {
        setFumeroSubmitting(false);
        resetFumeroPrep();
      };

      const beginFumeroActivity = () => {
        const first = fumeroPrepStatusLabel(t);
        setFumeroSubmitting(true);
        prepStepAtRef.current = Date.now();
        lastPrepStepRef.current = first;
        fumeroPrepActivitiesRef.current = [first];
        setFumeroPrepActivities([first]);
        setFumeroPrepStatus(first);
      };

      const maybeBouwenClarifyBeforeBuild = async (
        userPrompt: string
      ): Promise<boolean> => {
        const goals = await fetchFumeroGoals();
        const questions = bouwenClarifyingQuestions(userPrompt, goals);
        if (!questions?.length) return false;
        writePendingBouwenClarify({
          seedPrompt: userPrompt,
          clarifications: [],
        });
        appendAssistantMessage(formatBouwenClarifyAssistantMessage(questions));
        scrollBottom(true);
        endFumeroActivity();
        return true;
      };

      const pendingClarify = readPendingBouwenClarify();
      const awaitingClarify = Boolean(pendingClarify);
      const hasPreview = Boolean(
        livePreviewRef.current?.previewUrl || activeToolId || activeAppSlug
      );
      const toolActionOpts = {
        hasActiveTool: activeToolId != null,
        awaitingTemplate: awaitingToolTemplate,
        awaitingClarify,
        hasPreview,
        coderMode: fumeroCoderMode,
      };

      const handlePendingClarifyOrPreview = async (): Promise<boolean> => {
        const previewAction = resolveMaxToolChatAction(t, toolActionOpts);
        if (previewAction?.type === "open_preview") {
          showPromptInChat();
          setPreviewPanelOpen(true);
          appendAssistantMessage(formatPreviewOpenedMessage());
          endFumeroActivity();
          scrollBottom(true);
          return true;
        }
        if (!pendingClarify) return false;
        showPromptInChat();
        if (isBouwenContinueIntent(t)) {
          const merged = mergeBouwenClarifyPrompt(
            pendingClarify.seedPrompt,
            pendingClarify.clarifications,
            t
          );
          writePendingBouwenClarify(null);
          endFumeroActivity();
          setPreviewPanelOpen(true);
          await runToolBuild(merged);
          return true;
        }
        writePendingBouwenClarify({
          seedPrompt: pendingClarify.seedPrompt,
          clarifications: [...pendingClarify.clarifications, t],
        });
        appendAssistantMessage(formatClarifyAckMessage());
        endFumeroActivity();
        scrollBottom(true);
        return true;
      };

      if (maxCompanion) {
        beginFumeroActivity();
      }

      if (await handlePendingClarifyOrPreview()) return;

      if (isFumeroSiteCheckChatIntent(t)) {
        showPromptInChat();
        await sendFumeroMaxReply(t, fumeroCoderMode);
        return;
      }

      if (maxCompanion) {
        const maxAction = resolveMaxChatAction(t, maxCompanion.briefing);
        if (maxAction?.type === "inline_briefing" && maxCompanion.briefing) {
          showPromptInChat();
          appendAssistantMessage(
            formatMaxBriefingDetailMarkdown(maxCompanion.briefing)
          );
          scrollBottom(true);
          endFumeroActivity();
          return;
        }
        if (maxAction?.type === "redirect") {
          showPromptInChat();
          appendAssistantMessage(
            `**${maxAction.notice}**\n\nIk open de juiste studio met je opdracht.`
          );
          scrollBottom(true);
          endFumeroActivity();
          router.push(maxAction.href);
          return;
        }
      }

      // Coder/Bouwen: tool-build standaard; alleen duidelijke vragen → Max-chat (geen code dump)
      if (fumeroCoderMode) {
        const coderQuestionOnly = isCoderQuestionOnly(t, {
          awaitingTemplate: awaitingToolTemplate,
        });
        if (detectFullAppIntent(t) && !activeToolId && !activeAppSlug) {
          showPromptInChat();
          await runFullAppBuild(t);
          return;
        }

        if (activeAppSlug && !activeToolId) {
          const isRefineLike = /pas|aanpas|verfijn|wijzig|maak.*groen|kleur|voeg|verwijder|update|add|change/i.test(t);
          if (isRefineLike || t.length > 8) {
            showPromptInChat();
            await runAppIterate(t);
            return;
          }
        }

        if (onProjectPrompt && !bouwenWorkspace) {
          const action = resolveMotorsChatAction({ prompt: t, hasActiveProject });
          if (action.type === "code-workspace") {
            showPromptInChat();
            router.push(`/code?q=${encodeURIComponent(t)}`);
            scrollBottom(true);
            return;
          }
          if (action.type === "project-start" || action.type === "project-iterate") {
            showPromptInChat();
            setPreviewPanelOpen(true);
            setBuildStatusUnlessCoder(motorsActionLabel(action));
            try {
              await onProjectPrompt(t, activeConversationId);
            } catch (err) {
              setArtifactErr(
                err instanceof Error ? err.message : "Project-build mislukt"
              );
            } finally {
              setBuildStatus(null);
            }
            scrollBottom(true);
            return;
          }
        }

        const toolAction = resolveMaxToolChatAction(t, toolActionOpts);

        if (planMode && !activeToolId && !activeAppSlug && toolAction) {
          const quickPick = resolveTemplateFromQuickReply(t);
          const explicitTpl = resolveTemplateFromUserText(t);
          const shouldBuildNow =
            !coderQuestionOnly ||
            CODER_BUILD_TRIGGER_RE.test(t) ||
            (quickPick?.templateId && quickPick.templateId !== "custom") ||
            Boolean(explicitTpl) ||
            awaitingToolTemplate ||
            toolAction.type === "tool_build" ||
            toolAction.type === "tool_iterate";
          if (!shouldBuildNow) {
            showPromptInChat();
            appendAssistantMessage(
              "Ik noteer je idee in **plan-modus** — ik bouw pas als je **Maak** zegt, een sjabloon kiest, of een concrete tool noemt (bv. rekenmachine).\n\n" +
                `**Doel:** ${t}`
            );
            scrollBottom(true);
            endFumeroActivity();
            return;
          }
        }

        if (toolAction?.type === "tool_intent_pick") {
          showPromptInChat();
          endFumeroActivity();
          showToolTemplatePicker(awaitingToolTemplate ? activeToolPrompt : t);
          scrollBottom(true);
          return;
        }
        if (toolAction?.type === "tool_iterate" && activeToolId) {
          showPromptInChat();
          setPreviewPanelOpen(true);
          await runToolIterate(t);
          return;
        }
        if (toolAction?.type === "tool_build") {
          showPromptInChat();
          if (await maybeBouwenClarifyBeforeBuild(t)) return;
          setPreviewPanelOpen(true);
          await runToolBuild(t, awaitingToolTemplate ? activeToolPrompt : undefined);
          return;
        }

        if (coderQuestionOnly) {
          showPromptInChat();
          await sendFumeroMaxReply(t, true);
          return;
        }

        showPromptInChat();
        setPreviewPanelOpen(true);
        if (activeToolId) {
          await runToolIterate(t);
        } else {
          await runToolBuild(t, awaitingToolTemplate ? activeToolPrompt : undefined);
        }
        return;
      }

      if (!maxCompanion) {
        showPromptInChat();
        void send(t, { ...chatSendOpts, skipUserMessage: true });
        return;
      }

      // Fase 2/5: full-app intent — nu met Lovable app-card (preview + pas aan + deploy)
      if (detectFullAppIntent(t) && !activeToolId && !activeAppSlug) {
        showPromptInChat();
        await runFullAppBuild(t);
        return;
      }

      // Fase 5: when app active in chat, "pas aan" text also routes to app refine (data safe)
      if (activeAppSlug && !activeToolId) {
        const isRefineLike = /pas|aanpas|verfijn|wijzig|maak.*groen|kleur|voeg|verwijder|update|add|change/i.test(t);
        if (isRefineLike || t.length > 8) {
          showPromptInChat();
          await runAppIterate(t);
          return;
        }
      }

      const toolAction = resolveMaxToolChatAction(t, toolActionOpts);
      if (toolAction) {
        showPromptInChat();
        if (toolAction.type === "tool_intent_pick") {
          endFumeroActivity();
          showToolTemplatePicker(t);
          scrollBottom(true);
          return;
        }
        if (toolAction.type === "tool_iterate" && activeToolId) {
          await runToolIterate(t);
          return;
        }
        if (toolAction.type === "tool_build") {
          if (await maybeBouwenClarifyBeforeBuild(t)) return;
          await runToolBuild(t, awaitingToolTemplate ? activeToolPrompt : undefined);
          return;
        }
      }

      const canvasAction = resolveMaxCanvasChatAction(t);
      const contentAction = resolveMaxContentChatAction(t);

      if (canvasAction || (fumeroCanvasMode && contentAction)) {
        showPromptInChat();
        const raw = canvasAction ?? contentAction!;
        await runContentGenerate(
          {
            type: "content_generate",
            contentType: raw.contentType,
            platform: raw.platform,
            prompt: raw.prompt,
          },
          { canvasMode: true }
        );
        return;
      }

      if (fumeroCanvasMode && !contentAction && !canvasAction) {
        showPromptInChat();
        await runContentGenerate(
          {
            type: "content_generate",
            contentType: "seo_article",
            platform: "blog",
            prompt: t,
          },
          { canvasMode: true }
        );
        return;
      }

      if (contentAction) {
        showPromptInChat();
        await runContentGenerate(contentAction, {
          canvasMode: Boolean(canvasAction),
        });
        return;
      }
    }

    const useUnified =
      unifiedMode && (onBuildArtifact || onProjectPrompt);

    if (useUnified) {
      const action = resolveMotorsChatAction({ prompt: t, hasActiveProject });
      const label = motorsActionLabel(action);

      if (action.type === "artifact" && onBuildArtifact) {
        showPromptInChat();
        setArtifactErr(null);
        setBuildStatus(label);
        try {
          await onBuildArtifact(t);
        } catch (err) {
          setArtifactErr(
            err instanceof Error ? err.message : "App bouwen mislukt"
          );
        } finally {
          setBuildStatus(null);
        }
        scrollBottom(true);
        return;
      }

      if (action.type === "code-workspace") {
        showPromptInChat();
        router.push(`/code?q=${encodeURIComponent(t)}`);
        scrollBottom(true);
        return;
      }

      if (
        (action.type === "project-start" || action.type === "project-iterate") &&
        onProjectPrompt
      ) {
        showPromptInChat();
        setArtifactErr(null);
        setBuildStatus(label);
        try {
          await onProjectPrompt(t, activeConversationId);
        } catch (err) {
          setArtifactErr(
            err instanceof Error ? err.message : "Project-build mislukt"
          );
        } finally {
          setBuildStatus(null);
        }
        scrollBottom(true);
        return;
      }
    } else if (preferProjectBuilds && onProjectPrompt) {
      const shouldProject =
        hasActiveProject ||
        isProjectIterationPrompt(t) ||
        isProjectStartPrompt(t);
      if (shouldProject) {
        showPromptInChat();
        setArtifactErr(null);
        try {
          await onProjectPrompt(t, activeConversationId);
        } catch (err) {
          setArtifactErr(
            err instanceof Error ? err.message : "Project-build mislukt"
          );
        }
        scrollBottom(true);
        return;
      }
    } else if (preferArtifactBuilds && onBuildArtifact && isBuildLikePrompt(t)) {
      showPromptInChat();
      setArtifactErr(null);
      try {
        await onBuildArtifact(t);
      } catch (err) {
        setArtifactErr(
          err instanceof Error ? err.message : "Artifact generatie mislukt"
        );
      }
      scrollBottom(true);
      return;
    }

    showPromptInChat();
    if (workspace === "fumero" && maxCompanion) {
      await sendFumeroMaxReply(t, fumeroComposerMode === "coder");
      return;
    }
    await send(t, { ...chatSendOpts, skipUserMessage: true });
  },
  [
    activeConversationId,
    activeToolId,
    activeToolPrompt,
    appendAssistantMessage,
    appendUserMessage,
    artifactBusy,
    awaitingToolTemplate,
    chatSendOpts,
    convLoadError,
    ensureChatReady,
    fumeroPrepStatus,
    hasActiveProject,
    enabledConnectors,
    fumeroComposerMode,
    historyLoaded,
    maxCompanion,
    sendFumeroMaxReply,
    onBuildArtifact,
    onProjectPrompt,
    preferArtifactBuilds,
    preferProjectBuilds,
    router,
    runToolBuild,
    runToolIterate,
      runContentGenerate,
      runFullAppBuild,
      runAppIterate,
      onFumeroContentPreview,
      onFumeroLivePreview,
      setPreviewPanelOpen,
      scrollBottom,
    send,
    showToolTemplatePicker,
    streamingId,
    toolBusy,
    unifiedMode,
    workspace,
    activeAppSlug,
    fumeroCanvasMode,
    fumeroCoderMode,
    setPreviewPanelOpen,
  ]);

  useEffect(() => {
    if (!maxCompanion) return;
    maxCompanion.registerSend((prompt) => {
      void submitText(prompt);
    });
  }, [maxCompanion, submitText]);

  /* Briefing staat in topbar dagoverzicht — geen dubbele openingsboodschap in chat. */

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitText(text);
  };

  const runSuggested = async (prompt: string) => {
    if (streamingId) return;
    await submitText(prompt);
  };

  const focusComposer = useCallback(() => {
    textareaRef.current?.focus();
  }, []);

  const saveMessageToKnowledgeBank = useCallback(
    async (messageId: string, content: string) => {
      const trimmed = content.trim();
      if (!trimmed || knowledgeSaveMsgId) return;

      setKnowledgeSaveMsgId(messageId);
      try {
        const res = await fetch("/api/knowledge/save-from-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            klant: company,
            content: trimmed,
            source: "chat",
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          message?: string;
          pointsUpserted?: number;
        };
        if (!res.ok) {
          throw new Error(
            data.message || data.error || `Opslaan mislukt (${res.status})`
          );
        }
        showFumeroToast(
          data.pointsUpserted
            ? `Opgeslagen in kennisbank (${data.pointsUpserted} stukjes tekst)`
            : "Opgeslagen in kennisbank"
        );
      } catch (err) {
        showFumeroToast(
          err instanceof Error ? err.message : "Opslaan in kennisbank mislukt"
        );
      } finally {
        setKnowledgeSaveMsgId(null);
      }
    },
    [company, knowledgeSaveMsgId]
  );

  const handleVisualEditPick = useCallback(
    (hint: string) => {
      setVisualEditMode(false);
      onFumeroVisualEditModeChange?.(false);
      setText((prev) => (prev.trim() ? `${prev.trim()}\n${hint}` : hint));
      focusComposer();
    },
    [focusComposer, onFumeroVisualEditModeChange]
  );

  useEffect(() => {
    onRegisterVisualEditPick?.(handleVisualEditPick);
  }, [handleVisualEditPick, onRegisterVisualEditPick]);

  const handleFumeroMenuAction = useCallback(
    (action: FumeroComposerMenuAction) => {
      if (action.kind === "content") {
        setFumeroComposerMode("foto");
        void submitText(action.prompt);
        return;
      }
      if (action.kind === "canvas") {
        setFumeroComposerMode("canvas");
        setText(action.prompt);
        focusComposer();
        void runContentGenerate(
          {
            type: "content_generate",
            contentType: action.contentType,
            platform: action.platform,
            prompt: action.prompt,
          },
          { canvasMode: true }
        );
        return;
      }
      if (action.kind === "coder") {
        if (bouwenWorkspace) {
          setFumeroComposerMode("coder");
          setPreviewPanelOpen(true);
          setText(action.prompt ?? "");
          focusComposer();
          scrollBottom(true);
          return;
        }
        router.push(action.prompt ? `/fumero/bouwen?q=${encodeURIComponent(action.prompt)}` : "/fumero/bouwen");
        return;
      }
      if (action.kind === "research") {
        setFumeroComposerMode("online");
        setConnectorEnabled("online_research", true);
        setEnabledConnectors(readEnabledConnectors());
        setText(FUMERO_RESEARCH_PREFILL);
        focusComposer();
        return;
      }
      if (action.kind === "templates") {
        setFumeroComposerMode("coder");
        setPreviewPanelOpen(true);
        showToolTemplatePicker("");
        focusComposer();
        return;
      }
      if (action.kind === "ux_review") {
        void runUxReview();
        return;
      }
    },
    [
      bouwenWorkspace,
      focusComposer,
      router,
      runContentGenerate,
      runUxReview,
      scrollBottom,
      setPreviewPanelOpen,
      showToolTemplatePicker,
      submitText,
    ]
  );

  const handleStarterWire = useCallback(
    (wire: FumeroChatStarterWire) => {
      if (streamingId) return;
      if (wire === "foto") {
        handleFumeroMenuAction({
          kind: "content",
          contentType: "product_photo",
          platform: "webshop",
          prompt:
            "Genereer een premium productfoto voor fumero.nl: scherp product, witte achtergrond, subtiele schaduw.",
        });
        return;
      }
      if (wire === "orders") {
        void runSuggested(
          "Geef een overzicht van openstaande orders: wat kwam er vandaag binnen en waar moet ik op letten?"
        );
        return;
      }
      if (wire === "canvas") {
        handleFumeroMenuAction({
          kind: "canvas",
          contentType: "seo_article",
          platform: "blog",
          prompt:
            "Schrijf een SEO-blogartikel voor fumero.nl over onze HHC/CBD collectie: heldere structuur, H1/H2, meta en body.",
        });
        return;
      }
      if (wire === "coder") {
        router.push("/fumero/bouwen");
        return;
      }
    },
    [handleFumeroMenuAction, router, runSuggested, streamingId]
  );

  const initialPromptSentRef = useRef(false);
  const submitTextRef = useRef(submitText);
  submitTextRef.current = submitText;

  useEffect(() => {
    if (!pendingSubmitRef.current) return;
    if (activeConversationId === undefined || !historyLoaded || streamingId) return;
    const pending = pendingSubmitRef.current;
    pendingSubmitRef.current = null;
    setFumeroPrepStatus(null);
    void submitTextRef.current(pending, { skipShowPrompt: true });
  }, [activeConversationId, historyLoaded, streamingId]);

  useEffect(() => {
    initialPromptSentRef.current = false;
  }, [initialPrompt]);

  const initialToolLoadedRef = useRef(false);
  useEffect(() => {
    initialToolLoadedRef.current = false;
  }, [initialToolId]);

  const initialAppLoadedRef = useRef(false);
  useEffect(() => {
    initialAppLoadedRef.current = false;
  }, [initialAppSlug]);

  useEffect(() => {
    const id = initialToolId;
    if (!id || initialToolLoadedRef.current) return;
    if (activeConversationId === undefined || !historyLoaded || streamingId) return;
    initialToolLoadedRef.current = true;
    void (async () => {
      await openExistingToolInChat(id);
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      if (!params.has("tool")) return;
      params.delete("tool");
      const qs = params.toString();
      const path = qs
        ? `${window.location.pathname}?${qs}`
        : window.location.pathname;
      router.replace(path, { scroll: false });
    })();
  }, [
    activeConversationId,
    historyLoaded,
    initialToolId,
    openExistingToolInChat,
    router,
    streamingId,
  ]);

  // Fase 5: load ?app=slug into chat with live app card (like ?tool=)
  useEffect(() => {
    const slug = initialAppSlug?.trim();
    if (!slug || initialAppLoadedRef.current) return;
    if (activeConversationId === undefined || !historyLoaded || streamingId) return;
    initialAppLoadedRef.current = true;
    void (async () => {
      await openExistingAppInChat(slug);
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      if (!params.has("app")) return;
      params.delete("app");
      const qs = params.toString();
      const path = qs
        ? `${window.location.pathname}?${qs}`
        : window.location.pathname;
      router.replace(path, { scroll: false });
    })();
  }, [
    activeConversationId,
    historyLoaded,
    initialAppSlug,
    openExistingAppInChat,
    router,
    streamingId,
  ]);

  useEffect(() => {
    const seed = initialPrompt?.trim();
    if (!seed || initialPromptSentRef.current) return;
    if (activeConversationId === undefined || !historyLoaded || streamingId) return;
    initialPromptSentRef.current = true;
    void (async () => {
      await submitTextRef.current(seed);
      if (typeof window === "undefined") return;
      const params = new URLSearchParams(window.location.search);
      if (!params.has("q")) return;
      params.delete("q");
      const qs = params.toString();
      router.replace(
        `${window.location.pathname}${qs ? `?${qs}` : ""}`,
        { scroll: false }
      );
    })();
  }, [
    initialPrompt,
    activeConversationId,
    historyLoaded,
    streamingId,
    router,
  ]);

  const startVoice = useCallback(() => {
    if (typeof window === "undefined") return;
    const W = window as unknown as {
      webkitSpeechRecognition?: SpeechRecCtor;
      SpeechRecognition?: SpeechRecCtor;
    };
    const Ctor = W.webkitSpeechRecognition || W.SpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "nl-NL";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const said = e.results[0][0].transcript?.trim() ?? "";
      if (said) setText((prev) => (prev ? `${prev} ${said}` : said));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }, []);

  const uploadChatFile = async (file: File) => {
    if (uploadBusy) return;
    if (!ensureChatReady()) return;
    const clientErr = validateChatUploadFile(file);
    if (clientErr) {
      setUploadNotice({ kind: "err", text: clientErr });
      return;
    }
    setUploadNotice(null);
    setUploadBusy(true);
    appendUserMessage(`📎 ${file.name} — uploaden…`);
    scrollBottom(true);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("klant", company);
    try {
      const data = await fetchJsonChecked<ChatUploadApiResponse>("/api/upload", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      setUploadNotice({
        kind: "ok",
        text: `"${file.name}" geüpload — vraag wordt verwerkt…`,
      });
      const msg = buildUploadChatMessage(file.name, data);
      void send(msg, chatSendOpts);
      setUploadNotice({
        kind: "ok",
        text: `"${file.name}" toegevoegd aan het gesprek.`,
      });
      scrollBottom(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload mislukt";
      setUploadNotice({ kind: "err", text: msg });
    } finally {
      setUploadBusy(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    await uploadChatFile(file);
  };

  const onComposerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploadBusy && activeConversationId !== undefined) {
      setComposerDragOver(true);
    }
  };

  const onComposerDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setComposerDragOver(false);
  };

  const onComposerDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setComposerDragOver(false);
    const files = [...e.dataTransfer.files];
    if (files.length === 0) return;
    for (const file of files) {
      await uploadChatFile(file);
    }
  };

  const onComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void onSubmit(e as unknown as React.FormEvent);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        void newChat();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setChatThreadsOpen(!sidebarOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const showEmpty =
    activeConversationId !== undefined &&
    historyLoaded &&
    messages.length === 0;

  const fumeroOps = workspace === "fumero";
  const fumeroEmptyHome = fumeroOps && Boolean(maxCompanion) && showEmpty;
  const bouwenEmptyHome = fumeroEmptyHome && bouwenWorkspace;
  const bouwenSplitActive =
    bouwenWorkspace && !bouwenEmptyHome && layout === "split" && previewPanelOpen;
  const splitPreviewOpen =
    fumeroOps && fumeroCoderMode && layout === "split" && previewPanelOpen;
  const streamAgentLabel = fumeroOps ? "Max" : agentTheme.agentName;
  const coderBuildQuiet = fumeroCoderMode && toolBusy && !streamingId;
  const assistantChatContent = useCallback(
    (content: string, streaming?: boolean) =>
      resolveAssistantChatDisplayContent(content, {
        coderMode: fumeroCoderMode,
        streaming,
      }),
    [fumeroCoderMode]
  );

  const fumeroCoderOverflowItems = useMemo((): FumeroCoderOverflowItem[] | undefined => {
    if (!fumeroCoderMode) return undefined;
    return [
      {
        id: "plan",
        label: planMode ? "Plan uit" : "Eerst plan maken",
        icon: ClipboardList,
        active: planMode,
        disabled: !!streamingId,
        onClick: () => togglePlanMode(),
      },
      {
        id: "visual-edits",
        label: "Klik om te wijzigen",
        icon: MousePointer2,
        active: visualEditMode,
        onClick: () => {
          const next = !visualEditMode;
          setVisualEditMode(next);
          onFumeroVisualEditModeChange?.(next);
          if (next) setPreviewPanelOpen(true);
        },
      },
      {
        id: "garage",
        label: "Mijn projecten",
        icon: Grid3X3,
        href: "/fumero/projecten",
        onClick: () => {},
      },
      {
        id: "ux-review",
        label: "Laat UX checken",
        icon: ScanEye,
        disabled: !activeToolId || !!streamingId,
        onClick: () => void runUxReview(),
      },
      ...(bouwenWorkspace
        ? []
        : [
            {
              id: "connectors",
              label: "Live shopdata",
              icon: Plug,
              onClick: () => setConnectorsOpen(true),
            },
          ]),
      {
        id: "turbo",
        label: fumeroTurboOn ? "Uitgebreid uit" : "Uitgebreid",
        icon: Zap,
        active: fumeroTurboOn,
        disabled: !!streamingId || (!agentReadiness.canEnable && !fumeroTurboOn),
        onClick: () => {
          if (fumeroTurboOn) {
            setFumeroTurboOn(false);
            return;
          }
          if (!agentReadiness.canEnable) {
            reportError(
              agentReadiness.blockReason ??
                "Uitgebreid is niet geconfigureerd op de server."
            );
            return;
          }
          setFumeroTurboOn(true);
        },
      },
    ];
  }, [
    fumeroCoderMode,
    bouwenWorkspace,
    planMode,
    activeToolId,
    streamingId,
    runUxReview,
    togglePlanMode,
    visualEditMode,
    onFumeroVisualEditModeChange,
    setPreviewPanelOpen,
    fumeroTurboOn,
    agentReadiness.canEnable,
    agentReadiness.blockReason,
    reportError,
  ]);

  const statusText =
    convLoadError ||
    externalStatusError ||
    artifactErr ||
    error ||
    uploadNotice?.text ||
    sanitizeUiStatusText(fumeroPrepStatus) ||
    (coderBuildQuiet ? null : sanitizeUiStatusText(buildStatus)) ||
    (streamingId && streamStatus ? sanitizeUiStatusText(streamStatus) : null) ||
    (toolBusy && !coderBuildQuiet ? sanitizeUiStatusText(buildStatus) ?? "Bezig…" : null);
  const statusIsError =
    Boolean(
      convLoadError ||
        externalStatusError ||
        artifactErr ||
        error ||
        uploadNotice?.kind === "err"
    );

  const renderThreadItem = (c: ConversationListItem) => (
    <li key={c.id} className="group relative">
      {editingId === c.id ? (
        <input
          autoFocus
          className="w-full rounded-lg border border-border bg-surface px-2 py-2 text-xs outline-none focus:ring-1 focus:ring-accent"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={() => {
            void renameConversation(c.id, editTitle);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              void renameConversation(c.id, editTitle);
            }
            if (e.key === "Escape") setEditingId(null);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <>
          <button
            type="button"
            className={cn(
              "ios-tap-highlight w-full rounded-lg px-2 py-2.5 pr-14 text-left text-[13px] leading-snug transition-colors hover:bg-surface-elevated",
              activeConversationId === c.id &&
                "bg-surface-elevated font-medium text-text-primary"
            )}
            onClick={() => setActiveConversationId(c.id)}
          >
            <span className="line-clamp-2">{c.title}</span>
          </button>
          <button
            type="button"
            className="ios-tap-highlight absolute right-9 top-1/2 flex min-h-[36px] min-w-[36px] -translate-y-1/2 items-center justify-center rounded-md text-text-secondary opacity-0 transition-opacity hover:bg-border group-hover:opacity-100"
            title="Hernoemen"
            onClick={(e) => {
              e.stopPropagation();
              setEditingId(c.id);
              setEditTitle(c.title);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            className="ios-tap-highlight absolute right-1 top-1/2 flex min-h-[36px] min-w-[36px] -translate-y-1/2 items-center justify-center rounded-md text-text-secondary opacity-0 transition-opacity hover:bg-border group-hover:opacity-100"
            title="Verwijderen"
            onClick={(e) => {
              e.stopPropagation();
              void deleteConversation(c.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </li>
  );

  return (
    <div
      className={cn(
        "flex min-h-0 flex-1 bg-background",
        (splitPreviewOpen || bouwenSplitActive) && "fumero-coder-split",
        !embedded &&
          layout !== "split" &&
          "h-[min(calc(100dvh-10rem),56rem)] rounded-2xl border border-border/50 shadow-sm",
        layout === "split" &&
          !bouwenWorkspace &&
          "h-full min-h-0 overflow-hidden rounded-none border-0 shadow-none bg-[var(--fumero-surface-muted)]",
        bouwenWorkspace &&
          layout === "split" &&
          "h-full min-h-0 overflow-hidden bg-transparent",
        embedded && "h-full min-h-[280px] rounded-xl border border-border/50"
      )}
    >
      <aside
        className={cn(
          "flex min-h-0 shrink-0 flex-col border-r border-border/40 bg-surface/40 transition-[width] duration-200 ease-out",
          bouwenWorkspace && "!hidden",
          sidebarOpen ? (embedded ? "w-52" : "w-60") : "w-0 overflow-hidden border-r-0"
        )}
      >
        <div className="flex min-h-0 w-60 max-w-full flex-1 flex-col">
          <div className="flex items-center gap-1 px-2 pt-2">
            <button
              type="button"
              className="ios-tap-highlight flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
              title="Zijbalk sluiten (⌘B)"
              aria-label="Zijbalk"
              onClick={() => setChatThreadsOpen(false)}
            >
              <PanelLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              className="ios-tap-highlight flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent/10 text-[13px] font-medium text-accent hover:bg-accent/15 disabled:opacity-50"
              disabled={!!streamingId}
              onClick={() => void newChat()}
            >
              <Plus className="h-4 w-4" />
              Nieuw
            </button>
          </div>
          <div className="px-2 pb-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
              <input
                type="search"
                value={threadSearch}
                onChange={(e) => setThreadSearch(e.target.value)}
                placeholder="Zoek gesprekken…"
                className="w-full rounded-xl border border-border/50 bg-surface py-2.5 pl-9 pr-3 text-[13px] outline-none focus:ring-1 focus:ring-accent/40"
                aria-label="Zoek gesprekken"
              />
            </div>
          </div>
          <ScrollArea className="min-h-0 flex-1 scrollbar-ios">
            <div className="space-y-3 p-1.5">
              {fumeroThreadGroups ? (
                <>
                  <div>
                    <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-text-secondary">
                      Recente
                    </p>
                    <ul className="space-y-0.5">
                      {fumeroThreadGroups.recent.map(renderThreadItem)}
                    </ul>
                  </div>
                  {fumeroThreadGroups.archive.length > 0 ? (
                    <details
                      className="fumero-chat-sidebar-archive group/archive"
                      open={archiveOpen}
                      onToggle={(e) =>
                        setArchiveOpen((e.target as HTMLDetailsElement).open)
                      }
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-1 px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-text-secondary">
                        <ChevronDown
                          className={cn(
                            "h-3 w-3 shrink-0 transition-transform",
                            archiveOpen && "rotate-180"
                          )}
                        />
                        Archief ({fumeroThreadGroups.archive.length})
                      </summary>
                      <ul className="mt-0.5 space-y-0.5">
                        {fumeroThreadGroups.archive.map(renderThreadItem)}
                      </ul>
                    </details>
                  ) : null}
                </>
              ) : (
                groupConversationsByDate(filteredConversations).map((group) => (
                  <div key={group.label}>
                    <p className="px-2 pb-1 text-[10px] font-medium uppercase tracking-wide text-text-secondary">
                      {group.label}
                    </p>
                    <ul className="space-y-0.5">
                      {group.items.map(renderThreadItem)}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </aside>

      <div
        className={cn(
          "flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          fumeroEmptyHome && "justify-center"
        )}
      >
        {!bouwenWorkspace && (!sidebarOpen || (agentMode && agentReadiness.hint)) && (
        <div className="flex shrink-0 items-center gap-2 px-3 py-2">
          {!sidebarOpen && (
            <button
              type="button"
              className="ios-tap-highlight flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-text-secondary hover:bg-surface-elevated"
              title="Gesprekken (⌘B)"
              onClick={() => setChatThreadsOpen(true)}
            >
              <PanelLeft className="h-5 w-5" />
            </button>
          )}
          {effectiveAgentMode && agentReadiness.hint && (
            <p className="min-w-0 flex-1 truncate text-[12px] text-text-secondary">
              Turbo · browser & automation
            </p>
          )}
          {agentReadiness.memoryActive &&
            historyLoaded &&
            activeConversationId !== undefined && (
              <p className="min-w-0 flex-1 truncate text-[11px] text-text-secondary/80">
                {workspace === "fumero"
                  ? "Max onthoudt dit gesprek · kennisbank = doorzoekbare docs · teamcontext in instellingen"
                  : "MotorsAI onthoudt dit gesprek · kennisbank = doorzoekbare docs · teamcontext in /settings/context"}
              </p>
            )}
        </div>
        )}

        <div
          ref={scrollRef}
          onScroll={onMessagesScroll}
          onDragOver={onComposerDragOver}
          onDragLeave={onComposerDragLeave}
          onDrop={(e) => void onComposerDrop(e)}
          className={cn(
            "overflow-x-hidden overscroll-contain scrollbar-ios",
            fumeroEmptyHome
              ? "flex-none overflow-visible"
              : "min-h-0 flex-1 overflow-y-auto"
          )}
        >
          <div
            className={cn(
              "motors-chat-column space-y-6 px-4 py-6 md:py-8",
              splitPreviewOpen && "space-y-4 px-3 py-4 md:py-5",
              fumeroEmptyHome &&
                !bouwenWorkspace &&
                "fumero-chat-empty-home flex flex-1 flex-col items-center justify-center py-10",
              bouwenEmptyHome &&
                "bouwen-empty-home-scroll builder-empty-home-shell flex min-h-[min(100%,32rem)] w-full flex-1 flex-col items-center justify-center overflow-y-auto px-3 py-8 md:py-10"
            )}
          >
            {convLoadError ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <p className="text-[15px] text-text-secondary">{convLoadError}</p>
                <button
                  type="button"
                  className="rounded-lg border border-border px-4 py-2 text-sm text-text-primary hover:bg-surface-elevated"
                  onClick={() => void loadConversations()}
                >
                  Opnieuw proberen
                </button>
              </div>
            ) : null}
            {!convLoadError &&
            (activeConversationId === undefined ||
              (!historyLoaded && messages.length === 0)) ? (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <p className="text-[15px] text-text-secondary">
                  {activeConversationId === undefined
                    ? "Conversaties laden…"
                    : "Geschiedenis laden…"}
                </p>
                {slowConvLoad ? (
                  <p className="text-[13px] text-text-secondary">
                    Het duurt langer dan normaal — je kunt al typen in het veld
                    hieronder.
                  </p>
                ) : null}
              </div>
            ) : null}

            {bouwenEmptyHome ? (
              <BouwenEmptyHome
                promptValue={text}
                onPromptChange={setText}
                onSubmit={(prompt) => void runSuggested(prompt)}
                onUploadClick={() => fileRef.current?.click()}
                onVoiceClick={startVoice}
                onSelectSuggestion={(prompt) => void runSuggested(prompt)}
                onContinueProject={(id) => setActiveConversationId(id)}
                recentProjects={conversations}
                disabled={!!streamingId || toolBusy || Boolean(fumeroPrepStatus)}
                loading={Boolean(fumeroPrepStatus || fumeroSubmitting)}
                listening={listening}
              />
            ) : null}

            {showEmpty && !bouwenWorkspace ? (
              <div
                className={cn(
                  "flex w-full flex-col items-center text-center font-ws",
                  fumeroEmptyHome && "max-w-[720px] gap-8"
                )}
              >
                {(workspace === "fumero" || workspace === "bokas") && (
                  <AgentAvatar workspace={workspace} size="lg" />
                )}
                <div>
                  <h2 className="fumero-text-display text-text-primary">
                    {workspace === "fumero"
                      ? `Hey — ik ben ${agentTheme.agentName}`
                      : workspace === "bokas"
                        ? `Hoi! Ik ben ${agentTheme.agentName}`
                        : unifiedMode
                        ? "MotorsAI"
                        : preferProjectBuilds
                          ? "Project bouwen"
                          : "Waar kan ik mee helpen?"}
                  </h2>
                  <p className="fumero-text-body mt-2 max-w-[480px] text-text-secondary">
                    {workspace === "fumero"
                      ? fumeroEmptyHome
                        ? "Typ je vraag — kies hieronder een startpunt."
                        : "Stel een vraag in gewone taal — Snel is standaard. + voor foto, schrijven, bouwen of online onderzoek."
                      : workspace === "bokas"
                        ? "Jouw Bokas AI voor restaurant, reserveringen en team."
                        : unifiedMode
                        ? "Vraag, bouw of codeer in gewone taal — React, Next.js of HTML. MotorsAI kiest zelf wat nodig is."
                        : preferProjectBuilds
                          ? "Beschrijf je mini-product in gewone taal (NL). MotorsAI maakt een multi-file project met preview — daarna kun je itereren (“pas de header aan”)."
                          : "Stel een vraag of kies een suggestie om te beginnen."}
                  </p>
                </div>
                {fumeroEmptyHome ? (
                  <>
                    <FumeroChatStarterCards
                      disabled={!!streamingId}
                      onWire={handleStarterWire}
                      excludeWires={["coder"]}
                    />
                    <p className="mt-2 text-center text-[12px] text-[var(--fumero-text-muted)]">
                      Tool of widget bouwen?{" "}
                      <button
                        type="button"
                        className="font-medium text-[var(--fumero-success-fg)] underline-offset-2 hover:underline"
                        onClick={() => router.push("/fumero/bouwen")}
                      >
                        Ga naar Bouwen
                      </button>
                    </p>
                  </>
                ) : null}
                {!fumeroEmptyHome ? (
                  <div className="flex flex-wrap justify-center gap-2">
                    {(workspace === "fumero" && maxCompanion?.quickActions?.length
                      ? maxCompanion.quickActions
                      : workspace === "fumero"
                      ? FUMERO_CHAT_SUGGESTIONS
                      : workspace === "bokas"
                        ? BOKAS_CHAT_SUGGESTIONS
                        : unifiedMode
                          ? UNIFIED_SUGGESTED_PROMPTS
                          : SUGGESTED_PROMPTS
                    ).map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        disabled={!!streamingId}
                        className="ios-tap-highlight min-h-[44px] rounded-full border border-border/60 bg-surface px-4 py-2 text-[14px] text-text-primary transition-colors hover:border-accent/40 hover:bg-surface-elevated disabled:opacity-50"
                        onClick={() => void runSuggested(s.prompt)}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {!fumeroEmptyHome &&
            messages.map((m, idx) => {
              const isLastAssistant =
                m.role === "assistant" &&
                !messages.slice(idx + 1).some((x) => x.role === "assistant");
              const showRegenerate =
                isLastAssistant &&
                m.content.trim() !== "" &&
                streamingId !== m.id;
              const coderCompactCard =
                splitPreviewOpen && (m.toolCard || m.appCard);

              if (
                splitPreviewOpen &&
                m.role === "assistant" &&
                !m.content.trim() &&
                !m.toolCard &&
                !m.appCard &&
                !m.toolQuickReplies?.length &&
                streamingId !== m.id
              ) {
                return null;
              }

              const toolCardNode = m.toolCard ? (
                <FumeroToolCard
                  card={m.toolCard}
                  busy={toolBusy && m.id === activeToolCardMsgId}
                  builderLabel={fumeroBuilderLabel}
                  splitPreviewOpen={splitPreviewOpen}
                  buildPhase={
                    toolBusy && m.id === activeToolCardMsgId
                      ? coderBuildPhase
                      : undefined
                  }
                  building={toolBusy && m.id === activeToolCardMsgId}
                  summary={toolCardOneLineSummary(m.content)}
                  onFocusPreview={() => setPreviewPanelOpen(true)}
                  onFocusComposer={focusComposer}
                  onRefine={async (instruction) => {
                    if (m.toolCard?.toolId) {
                      setActiveToolId(m.toolCard.toolId);
                      setActiveToolCardMsgId(m.id);
                    }
                    await runToolIterate(instruction);
                  }}
                  onDeploy={async () => {
                    if (m.toolCard?.toolId) {
                      setActiveToolId(m.toolCard.toolId);
                      setActiveToolCardMsgId(m.id);
                    }
                    await runToolPublish();
                  }}
                />
              ) : null;

              const appCardNode = m.appCard ? (
                <FumeroToolCard
                  card={{
                    toolId: 0,
                    name: m.appCard.name,
                    previewUrl: m.appCard.previewUrl,
                    deployType: m.appCard.type as any,
                    status: m.appCard.status,
                    embedCode: m.appCard.embedCode,
                    internalUrl: m.appCard.internalUrl,
                    slug: m.appCard.slug,
                    tables: m.appCard.tables,
                    authRequired: m.appCard.authRequired,
                    hasPwa: m.appCard.hasPwa,
                    version: m.appCard.version,
                  } as any}
                  busy={toolBusy && m.id === activeAppCardMsgId}
                  builderLabel={fumeroBuilderLabel}
                  splitPreviewOpen={splitPreviewOpen}
                  summary={toolCardOneLineSummary(m.content)}
                  onFocusPreview={() => setPreviewPanelOpen(true)}
                  onFocusComposer={focusComposer}
                  onRefine={async (instruction) => {
                    setActiveAppSlug(m.appCard!.slug);
                    setActiveAppCardMsgId(m.id);
                    await runAppIterate(instruction);
                  }}
                  onDeploy={async () => {
                    setActiveAppSlug(m.appCard!.slug);
                    setActiveAppCardMsgId(m.id);
                    await runAppPublish();
                  }}
                />
              ) : null;

              return (
                <div
                  key={m.id}
                  className={cn(
                    m.role === "user" ? "flex justify-end" : "w-full"
                  )}
                >
                  {m.role === "assistant" ? (
                    coderCompactCard ? (
                      <div className="w-full">
                        {toolCardNode}
                        {appCardNode}
                        {m.toolQuickReplies?.length ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {m.toolQuickReplies.map((q) => (
                              <button
                                key={q.label}
                                type="button"
                                disabled={!!streamingId || toolBusy}
                                className="ios-tap-highlight min-h-[40px] rounded-full border border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-3 py-1.5 text-[13px] text-[var(--fumero-text)] transition-colors hover:border-[color-mix(in_srgb,var(--fumero-accent)_50%,transparent)] disabled:opacity-50"
                                onClick={() => void runSuggested(q.prompt)}
                              >
                                {q.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                    <div className="flex w-full gap-3">
                      <AgentAvatar
                        workspace={workspace}
                        size="sm"
                        className="mt-1 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="mb-1 text-[12px] font-semibold text-ws-accent">
                          {workspace === "fumero" ? "Max" : agentTheme.agentName}
                        </p>
                        <div className="text-[15px] leading-relaxed text-text-primary">
                          {streamingId === m.id ? (
                            <>
                              {assistantChatContent(m.content, true).trim() ? (
                                <MotorsChatMarkdown
                                  content={assistantChatContent(m.content, true)}
                                  variant="assistant"
                                />
                              ) : (
                                fumeroOps ? (
                                  <FumeroMaxActivityFeed
                                    statusLabel={streamStatus}
                                    activities={
                                      streamActivities.length
                                        ? streamActivities
                                        : fumeroPrepActivities
                                    }
                                    stuckHint={fumeroStuckHint}
                                  />
                                ) : (
                                  <MotorThinkingBlock
                                    turbo={effectiveAgentMode}
                                    statusLabel={streamStatus}
                                    activities={streamActivities}
                                    agentLabel={streamAgentLabel}
                                    accent={fumeroOps}
                                  />
                                )
                              )}
                              {assistantChatContent(m.content, true).trim() ? (
                                <MotorStreamPulse
                                  statusLabel={streamStatus}
                                  agentLabel={streamAgentLabel}
                                  accent={fumeroOps}
                                />
                              ) : null}
                            </>
                          ) : (
                            <>
                              {!(
                                splitPreviewOpen &&
                                (m.toolCard || m.appCard)
                              ) ? (
                                <MotorsChatMarkdown
                                  content={assistantChatContent(m.content)}
                                  variant="assistant"
                                />
                              ) : null}
                              {m.toolQuickReplies?.length ? (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {m.toolQuickReplies.map((q) => (
                                    <button
                                      key={q.label}
                                      type="button"
                                      disabled={!!streamingId || toolBusy}
                                      className="ios-tap-highlight min-h-[40px] rounded-full border border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-3 py-1.5 text-[13px] text-[var(--fumero-text)] transition-colors hover:border-[color-mix(in_srgb,var(--fumero-accent)_50%,transparent)] disabled:opacity-50"
                                      onClick={() => void runSuggested(q.prompt)}
                                    >
                                      {q.label}
                                    </button>
                                  ))}
                                </div>
                              ) : null}
                              {toolCardNode}
                              {appCardNode}
                              {m.contentCard?.canvasMode ? (
                                <button
                                  type="button"
                                  className="fumero-content-card ios-tap-highlight mt-3 flex w-full max-w-sm items-center justify-between gap-3 px-3 py-2.5 text-left"
                                  onClick={() => {
                                    if (!m.contentCard) return;
                                    onFumeroContentPreview?.({
                                      contentType:
                                        m.contentCard.contentType ?? "seo_article",
                                      platform: m.contentCard.platform ?? "blog",
                                      content:
                                        m.contentCard.documentContent ??
                                        m.contentCard.contentSnippet,
                                      mediaKind: "text",
                                      postId: m.contentCard.postId,
                                      status: "ready",
                                      title:
                                        m.contentCard.title ??
                                        contentPreviewTitle(
                                          m.contentCard.contentType ?? "seo_article",
                                          m.contentCard.platform ?? "blog"
                                        ),
                                      canvasMode: true,
                                    });
                                    setLivePreview(null);
                                    setPreviewPanelOpen(true);
                                  }}
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-[13px] font-medium text-[var(--fumero-text)]">
                                      {m.contentCard.title ?? "Schrijven-document"}
                                    </p>
                                    <p className="line-clamp-2 text-[11px] text-[var(--fumero-text-muted)]">
                                      {m.contentCard.contentSnippet ??
                                        "Long-form document — tik om te openen"}
                                    </p>
                                  </div>
                                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--fumero-success-bg)] px-2.5 py-1 text-[11px] font-medium text-[var(--fumero-success-fg)]">
                                    <PanelRightOpen className="h-3.5 w-3.5" />
                                    Open
                                  </span>
                                </button>
                              ) : null}
                              {m.contentCard?.mediaUrl &&
                              m.contentCard.mediaKind === "image" ? (
                                <button
                                  type="button"
                                  className="mt-3 block max-w-[240px] overflow-hidden rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] text-left shadow-sm transition hover:border-[color-mix(in_srgb,var(--fumero-accent)_40%,transparent)]"
                                  onClick={() => {
                                    if (!m.contentCard) return;
                                    onFumeroContentPreview?.({
                                      contentType:
                                        m.contentCard.contentType ?? "product_photo",
                                      platform: m.contentCard.platform ?? "instagram",
                                      mediaUrl: m.contentCard.mediaUrl,
                                      mediaKind: "image",
                                      postId: m.contentCard.postId,
                                      status: "ready",
                                      title: contentPreviewTitle(
                                        m.contentCard.contentType ?? "product_photo",
                                        m.contentCard.platform ?? "instagram"
                                      ),
                                    });
                                    setLivePreview(null);
                                  }}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={m.contentCard.mediaUrl}
                                    alt="Gegenereerde afbeelding"
                                    className="max-h-40 w-full object-cover"
                                  />
                                  <p className="px-2 py-1.5 text-[11px] text-[var(--fumero-text-muted)]">
                                    Tik voor preview-paneel
                                  </p>
                                </button>
                              ) : null}
                              {m.chatHistoryId != null &&
                                m.content.trim() !== "" && (
                                  <MessageFeedback
                                    messageId={m.chatHistoryId}
                                    klant={company}
                                  />
                                )}
                              {m.content.trim() !== "" &&
                                m.usageLine &&
                                !fumeroOps && (
                                <p className="mt-2 text-[11px] text-text-secondary/80">
                                  {m.usageLine}
                                </p>
                              )}
                              {m.content.trim() !== "" && (
                                <div className="mt-2 flex flex-wrap gap-1 border-t border-border/30 pt-2">
                                  <button
                                    type="button"
                                    className="ios-tap-highlight inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-[12px] text-text-secondary hover:bg-border/50 hover:text-text-primary"
                                    onClick={() => {
                                      void navigator.clipboard.writeText(
                                        m.content
                                      );
                                    }}
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                    Kopiëren
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      !!streamingId ||
                                      knowledgeSaveMsgId === m.id
                                    }
                                    title="Permanent in de kennisbank (doorzoekbaar). Vaste teamachtergrond staat in instellingen → context."
                                    className="ios-tap-highlight inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-[12px] text-text-secondary hover:bg-border/50 hover:text-text-primary disabled:opacity-50"
                                    onClick={() =>
                                      void saveMessageToKnowledgeBank(
                                        m.id,
                                        m.content
                                      )
                                    }
                                  >
                                    {knowledgeSaveMsgId === m.id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <BookMarked className="h-3.5 w-3.5" />
                                    )}
                                    Opslaan in kennisbank
                                  </button>
                                  {showRegenerate && (
                                    <button
                                      type="button"
                                      disabled={!!streamingId}
                                      className="ios-tap-highlight inline-flex min-h-[44px] items-center gap-1 rounded-lg px-2 text-[12px] text-text-secondary hover:bg-border/50 hover:text-text-primary disabled:opacity-50"
                                      onClick={() =>
                                        void regenerate(chatSendOpts)
                                      }
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
                                      Opnieuw
                                    </button>
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    )
                  ) : (
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed shadow-sm",
                        fumeroOps
                          ? "fumero-user-bubble"
                          : "bg-accent text-[var(--fumero-accent-foreground)]"
                      )}
                    >
                      <MotorsChatMarkdown
                        content={m.content}
                        variant={fumeroOps ? "fumeroUser" : "user"}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {fumeroPrepStatus && !streamingId ? (
              <div className="flex gap-3 px-4 py-3">
                <AgentAvatar workspace={workspace} size="sm" className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-[12px] font-semibold text-ws-accent">Max</p>
                  <FumeroMaxActivityFeed
                    statusLabel={fumeroPrepStatus}
                    activities={fumeroPrepActivities}
                    stuckHint={fumeroStuckHint}
                  />
                </div>
              </div>
            ) : null}
            {!fumeroEmptyHome ? (
              <div ref={bottomRef} className="h-px shrink-0" aria-hidden />
            ) : null}
          </div>
        </div>

        {statusText && !fumeroEmptyHome && !(fumeroCoderMode && toolBusy) && (
          <div
            className={cn(
              "flex shrink-0 items-center justify-between gap-2 border-t px-4 py-2 text-[13px]",
              statusIsError ? "text-error" : "text-text-secondary"
            )}
          >
            <span className="min-w-0 flex-1">{statusText}</span>
            {statusIsError && (
              <button
                type="button"
                className="ios-tap-highlight shrink-0 min-h-[36px] rounded-lg px-3 text-[13px] font-medium underline"
                onClick={() => {
                  clearError();
                  setArtifactErr(null);
                  setUploadNotice(null);
                  void regenerate(chatSendOpts);
                }}
              >
                Opnieuw proberen
              </button>
            )}
          </div>
        )}


        {!fumeroOps ? (
          <MotorUsageStrip company={company} refreshKey={messages.length} />
        ) : null}

        {planMode && !fumeroOps ? (
          <p className="motors-chat-column px-3 pb-1 text-center text-[11px] text-violet-300/90">
            Plan-modus — Motor maakt eerst een stappenplan. Zeg &quot;ga door&quot;
            om uit te voeren.
          </p>
        ) : null}
        {planMode && fumeroCoderMode && !bouwenEmptyHome ? (
          <p className="motors-chat-column px-3 pb-1 text-center text-[11px] text-[var(--fumero-success-fg)]">
            Plan-modus — ik bouw pas na <strong>Maak</strong>, een sjabloon of
            expliciete tool-opdracht.
          </p>
        ) : null}

        {fumeroCoderMode && fumeroOps && maxCompanion && !toolBusy && !bouwenEmptyHome ? (
          <ol className="motors-chat-column mb-2 flex w-full max-w-3xl list-none flex-wrap justify-center gap-2 self-center px-4 text-center">
            {(fumeroModelTier === "flash" && !activeToolId
              ? [
                  { n: "1", label: "Stel je vraag" },
                  { n: "2", label: "Snel antwoord in chat" },
                  { n: "3", label: "Pro/Normaal om te bouwen" },
                ]
              : [
                  { n: "1", label: "Beschrijf je tool" },
                  { n: "2", label: "Bekijk preview rechts" },
                  { n: "3", label: "Deploy naar garage" },
                ]
            ).map((step) => (
              <li
                key={step.n}
                className="inline-flex items-center gap-1.5 rounded-full border border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-3 py-1 text-[11px] font-medium text-[var(--fumero-text-muted)]"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[var(--fumero-success-bg)] text-[10px] font-semibold text-[var(--fumero-success-fg)]">
                  {step.n}
                </span>
                {step.label}
              </li>
            ))}
          </ol>
        ) : null}

        {visualEditMode && fumeroCoderMode ? (
          <p className="motors-chat-column mb-1 text-center text-[11px] text-[var(--fumero-success-fg)]">
            Klik in de preview of beschrijf hieronder wat je wilt wijzigen.
          </p>
        ) : null}

        <form
          onSubmit={onSubmit}
          onDragOver={onComposerDragOver}
          onDragLeave={onComposerDragLeave}
          onDrop={(e) => void onComposerDrop(e)}
          className={cn(
            "motors-composer shrink-0 backdrop-blur-sm",
            bouwenEmptyHome && "hidden",
            fumeroEmptyHome && !bouwenWorkspace
              ? "w-full max-w-3xl self-center border-0 bg-transparent px-4 pb-6 pt-2"
              : !bouwenEmptyHome && "p-3",
            !fumeroEmptyHome &&
              fumeroOps &&
              maxCompanion &&
              "fumero-composer-gemini border-t border-[var(--fumero-border)]/80 bg-[var(--fumero-surface-muted)]/95",
            !fumeroEmptyHome && !fumeroOps && "border-t border-border/40 bg-background/80",
            !fumeroEmptyHome &&
              fumeroOps &&
              !maxCompanion &&
              "border-t border-border/40 bg-background/80"
          )}
        >
          {fumeroOps && maxCompanion && (fumeroPrepStatus || streamingId) ? (
            <div
              className="motors-chat-column mb-2 flex max-w-full items-center gap-2 px-1 text-[11px] text-[var(--fumero-text-muted)]"
              aria-live="polite"
            >
              <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-[var(--fumero-accent)]" />
              <span className="min-w-0 truncate font-medium text-[var(--fumero-success-fg)]">
                {fumeroPrepStatus || streamStatus || "Max werkt…"}
              </span>
              {fumeroStuckHint ? (
                <span className="hidden shrink-0 text-[var(--fumero-text-muted)] sm:inline">
                  · {fumeroStuckHint}
                </span>
              ) : null}
            </div>
          ) : (streamingId && streamStatus && !statusIsError && !coderBuildQuiet) ? (
            <p
              className={cn(
                "motors-chat-column mb-2 flex items-center justify-center gap-1.5 text-[11px]",
                fumeroOps
                  ? "text-[var(--fumero-text-muted)]"
                  : "text-text-secondary/80"
              )}
              aria-live="polite"
            >
              <MotorTypingDots accent={fumeroOps} />
              <span>{streamStatus}</span>
            </p>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept={CHAT_UPLOAD_ACCEPT}
            onChange={(e) => void onFile(e)}
          />
          {fumeroOps && maxCompanion ? (
            <div
              className={cn(
                "motors-chat-column fumero-composer-shell relative overflow-visible transition-colors",
                composerDragOver && "fumero-composer-drag",
                (streamingId || fumeroPrepStatus || fumeroSubmitting) &&
                  "ring-1 ring-[var(--fumero-accent)]/20 fumero-composer-busy"
              )}
            >
              {composerDragOver ? (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[var(--fumero-accent-muted)] px-4 text-center text-[13px] font-medium text-[var(--fumero-success-fg)]">
                  Laat los — afbeelding, PDF of screenshot (max 25 MB)
                </div>
              ) : null}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onComposerKeyDown}
                placeholder={fumeroComposerPlaceholder(fumeroComposerMode, {
                  modelTier: fumeroModelTier,
                  bouwenWorkspace,
                })}
                rows={1}
                className="max-h-40 min-h-[44px] w-full resize-none bg-transparent px-4 pb-1 pt-3 fumero-text-body text-[var(--fumero-text)] outline-none placeholder:text-[var(--fumero-text-muted)]"
                autoComplete="off"
                disabled={artifactBusy || toolBusy || Boolean(fumeroPrepStatus)}
                aria-busy={activeConversationId === undefined}
              />
              <FumeroComposerToolbar
                variant="inline"
                modelTier={fumeroModelTier}
                onModelTierChange={setFumeroModelTier}
                onMenuAction={handleFumeroMenuAction}
                onPrefill={(prefill) => {
                  setText(prefill);
                  focusComposer();
                }}
                composerMode={fumeroComposerMode}
                onComposerModeChange={(mode) => {
                  setFumeroComposerMode(mode);
                  if (mode === "online") {
                    setConnectorEnabled("online_research", true);
                    setEnabledConnectors(readEnabledConnectors());
                  }
                }}
                hideModePill={bouwenWorkspace}
                onConnectorsOpen={() => setConnectorsOpen(true)}
                onUploadClick={() => fileRef.current?.click()}
                disabled={
                  !!streamingId ||
                  activeConversationId === undefined ||
                  toolBusy ||
                  Boolean(fumeroPrepStatus)
                }
                coderOverflowItems={fumeroCoderOverflowItems}
              >
                {!fumeroCoderMode ? (
                  <MotorTurboButton
                    active={fumeroTurboOn}
                    disabled={!!streamingId}
                    available={agentReadiness.canEnable}
                    onToggle={() => {
                      if (fumeroTurboOn) {
                        setFumeroTurboOn(false);
                        return;
                      }
                      if (!agentReadiness.canEnable) {
                        reportError(
                          agentReadiness.blockReason ??
                            "Turbo is niet geconfigureerd op de server."
                        );
                        return;
                      }
                      setFumeroTurboOn(true);
                    }}
                  />
                ) : null}
                <button
                  type="button"
                  className={cn(
                    "ios-tap-highlight flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-[var(--fumero-text-muted)] transition-colors hover:bg-[var(--fumero-surface-muted)] hover:text-[var(--fumero-text)] disabled:opacity-40",
                    listening && "text-[var(--fumero-accent)] ring-2 ring-[var(--fumero-accent)]/25"
                  )}
                  title="Spraak"
                  disabled={!!streamingId || activeConversationId === undefined}
                  onClick={startVoice}
                >
                  <Mic className="h-[18px] w-[18px]" />
                </button>
                {streamingId || fumeroPrepStatus || fumeroSubmitting ? (
                  <button
                    type="button"
                    className="ios-tap-highlight flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-[#fee2e2] text-[#b91c1c]"
                    title={streamingId ? "Stop genereren" : "Bezig…"}
                    disabled={Boolean(fumeroPrepStatus || fumeroSubmitting) && !streamingId}
                    onClick={() => {
                      if (streamingId) stop();
                    }}
                  >
                    {streamingId ? (
                      <Square className="h-4 w-4 fill-current" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="ios-tap-highlight flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full bg-[var(--fumero-accent)] text-[var(--fumero-accent-foreground)] hover:bg-[var(--fumero-accent-hover)] disabled:opacity-40"
                    disabled={
                      !text.trim() ||
                      activeConversationId === undefined ||
                      artifactBusy ||
                      uploadBusy ||
                      toolBusy ||
                      fumeroSubmitting
                    }
                    title="Versturen"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                )}
              </FumeroComposerToolbar>
            </div>
          ) : (
            <div
              className={cn(
                "motors-composer motors-chat-column relative flex items-end gap-1 rounded-3xl border bg-surface/90 px-2 py-2 shadow-sm backdrop-blur-sm transition-colors",
                streamingId && fumeroOps && "ring-1 ring-[var(--fumero-accent)]/25",
                composerDragOver
                  ? "border-accent ring-2 ring-accent/25"
                  : "border-border/55"
              )}
            >
              {composerDragOver && (
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-3xl bg-accent/10 px-4 text-center text-[13px] font-medium text-accent">
                  {fumeroOps
                    ? "Laat los — afbeelding, PDF of document (max 25 MB)"
                    : "Laat bestand los (PDF, DOCX, TXT, MD, HTML — max 25 MB)"}
                </div>
              )}
              <button
                type="button"
                className="ios-tap-highlight flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:opacity-40"
                title="Bestand toevoegen"
                disabled={
                  !!streamingId ||
                  activeConversationId === undefined ||
                  uploadBusy
                }
                onClick={() => fileRef.current?.click()}
              >
                <Paperclip className="h-[18px] w-[18px]" />
              </button>
              <MotorPlanButton
                active={planMode}
                disabled={!!streamingId}
                onToggle={() => togglePlanMode()}
              />
              <MotorTurboButton
                active={motorChatMode === "motor_pro"}
                disabled={!!streamingId}
                available={agentReadiness.canEnable}
                onToggle={() => {
                  if (motorChatMode === "motor_pro") {
                    setMotorChatMode("motor");
                    return;
                  }
                  if (!agentReadiness.canEnable) {
                    reportError(
                      agentReadiness.blockReason ??
                        "Turbo is niet geconfigureerd op de server."
                    );
                    return;
                  }
                  setMotorChatMode("motor_pro");
                }}
              />
              <button
                type="button"
                className={cn(
                  "ios-tap-highlight flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary disabled:opacity-40",
                  listening && "text-accent ring-2 ring-accent/25"
                )}
                title="Spraak"
                disabled={!!streamingId || activeConversationId === undefined}
                onClick={startVoice}
              >
                <Mic className="h-[18px] w-[18px]" />
              </button>
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onComposerKeyDown}
                placeholder={
                  unifiedMode
                    ? hasActiveProject
                      ? "Stel een vraag of pas je project aan…"
                      : "Stel een vraag, bouw een app of schrijf code…"
                    : preferProjectBuilds
                      ? hasActiveProject
                        ? "Pas je project aan…"
                        : "Beschrijf je project…"
                      : "Typ je bericht… (Enter = versturen)"
                }
                rows={1}
                className={cn(
                  "max-h-40 min-h-[44px] flex-1 resize-none bg-transparent py-2.5 text-[15px] leading-snug outline-none",
                  fumeroOps
                    ? "text-[var(--fumero-text)] caret-[var(--fumero-text)] placeholder:text-[var(--fumero-text-muted)]"
                    : "text-text-primary caret-text-primary placeholder:text-text-secondary"
                )}
                autoComplete="off"
                disabled={
                  activeConversationId === undefined || artifactBusy
                }
              />
              {streamingId ? (
                <button
                  type="button"
                  className="ios-tap-highlight flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl bg-error/10 text-error hover:bg-error/20"
                  title="Stop genereren"
                  onClick={() => stop()}
                >
                  <Square className="h-5 w-5 fill-current" />
                </button>
              ) : (
                <button
                  type="submit"
                  className={cn(
                    "ios-tap-highlight flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[var(--fumero-accent-foreground)] hover:opacity-90 disabled:opacity-40",
                    fumeroOps ? "bg-[var(--fumero-accent)] hover:bg-[var(--fumero-accent-hover)]" : "bg-accent hover:bg-accent/90"
                  )}
                  disabled={
                    !text.trim() ||
                    activeConversationId === undefined ||
                    artifactBusy ||
                    uploadBusy
                  }
                  title="Versturen"
                >
                  <Send className="h-5 w-5" />
                </button>
              )}
            </div>
          )}
          <p className="motors-chat-column mt-2 text-center text-[11px] text-text-secondary/70">
            {workspace === "fumero"
              ? fumeroCoderMode
                ? bouwenWorkspace
                  ? "Beschrijf je tool · preview rechts · online zetten in de balk"
                  : fumeroEmptyHome
                    ? fumeroModelTier === "flash"
                      ? "Snelle vragen · kies Standaard/Grondig om te bouwen"
                      : "Beschrijf je tool · preview rechts · online zetten in de kaart"
                    : !coderPlanHintDismissed && !activeToolId && !toolBusy
                    ? (
                        <>
                          {fumeroModelTier === "flash"
                            ? "Snelle vragen · "
                            : "Verfijn hieronder · preview rechts · "}
                          <button
                            type="button"
                            className="text-[var(--fumero-success-fg)] underline-offset-2 hover:underline"
                            onClick={() => togglePlanMode()}
                          >
                            {planMode ? "plan uit" : "plan aan"}
                          </button>
                          {" · "}
                          <button
                            type="button"
                            className="text-[var(--fumero-text-muted)] hover:text-[var(--fumero-text)]"
                            aria-label="Tip sluiten"
                            onClick={() => setCoderPlanHintDismissed(true)}
                          >
                            ×
                          </button>
                        </>
                      )
                    : fumeroModelTier === "flash"
                      ? "Snelle vragen · Normaal/Pro om te bouwen"
                      : "Verfijn hieronder · preview rechts · Deploy in de kaart"
                : "Snel · Normaal · Pro — + voor foto, schrijven, bouwen, online"
              : "Plan = eerst stappen · Turbo = browser · ⌘N nieuw · ⌘B gesprekken"}
          </p>
        </form>
      </div>

      <FumeroPublishModal
        open={publishModalOpen}
        payload={publishModal}
        onClose={() => {
          setPublishModalOpen(false);
          setPublishModal(null);
        }}
      />
      {fumeroOps && maxCompanion ? (
        <FumeroConnectorsPanel
          open={connectorsOpen}
          onClose={() => setConnectorsOpen(false)}
          onChange={setEnabledConnectors}
        />
      ) : null}
    </div>
  );
}
