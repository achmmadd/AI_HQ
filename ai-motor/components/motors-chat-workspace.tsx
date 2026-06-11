"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MotorsChatPanel } from "@/components/motors-chat-panel";
import { ArtifactPanel } from "@/components/artifact-panel";
import { ProjectPreview } from "@/components/project-preview";
import { FumeroContentPreviewPanel } from "@/components/fumero/content-preview-panel";
import { FumeroCanvasPanel } from "@/components/fumero/fumero-canvas-panel";
import { FumeroLivePreviewPanel } from "@/components/fumero/live-preview-panel";
import { PanelCollapseRail } from "@/components/panel-collapse-rail";
import { useArtifact } from "@/hooks/useArtifact";
import { useProject } from "@/hooks/useProject";
import { useCompanyStore, chatKlantForWorkspace } from "@/stores/useCompanyStore";
import { useLayoutStore } from "@/stores/useLayoutStore";
import {
  BUILDER_CHAT_DEFAULT_PERCENT,
  builderChatPercentFromKeyboard,
  builderChatPercentFromPointer,
  persistBuilderChatPercent,
  readStoredBuilderChatPercent,
} from "@/lib/fumero/builder-layout";
import { stackDisplayName } from "@/lib/project-stack";
import type {
  FumeroContentPreviewPayload,
  FumeroLivePreviewPayload,
} from "@/lib/fumero/content-preview";
import { cn } from "@/lib/utils";
import type { FumeroBriefingPayload } from "@/lib/fumero/briefing";
import type { FumeroBouwenBridge } from "@/lib/fumero/bouwen-bridge";
import type { FumeroComposerMode } from "@/lib/fumero/composer-actions";
import type { FumeroPublishModalPayload } from "@/components/fumero/features/fumero-publish-modal";

export type MaxCompanionConfig = {
  briefing: FumeroBriefingPayload | null;
  openingMessage: string | null;
  quickActions: Array<{ label: string; prompt: string }>;
  registerSend: (fn: (prompt: string) => void) => void;
};

export function MotorsChatWorkspace({
  className,
  maxCompanion,
  onComposerModeChange,
  initialComposerMode,
  bouwenWorkspace = false,
  initialPrompt: initialPromptProp,
  onBouwenBridgeUpdate,
  onPublishSuccess,
}: {
  className?: string;
  maxCompanion?: MaxCompanionConfig;
  onComposerModeChange?: (mode: FumeroComposerMode) => void;
  initialComposerMode?: FumeroComposerMode;
  /** Dedicated /fumero/bouwen shell — always coder split, bouwen defaults. */
  bouwenWorkspace?: boolean;
  initialPrompt?: string | null;
  onBouwenBridgeUpdate?: (bridge: FumeroBouwenBridge) => void;
  onPublishSuccess?: (payload: FumeroPublishModalPayload) => void;
} = {}) {
  const sp = useSearchParams();
  const initialCoderMode =
    bouwenWorkspace ||
    initialComposerMode === "coder" ||
    sp.get("mode") === "coder";
  const [fumeroCoderActive, setFumeroCoderActive] = useState(initialCoderMode);
  const workspace = useCompanyStore((s) => s.workspace);
  const company = chatKlantForWorkspace(workspace);
  const previewPanelOpen = useLayoutStore((s) => s.previewPanelOpen);
  const setPreviewPanelOpen = useLayoutStore((s) => s.setPreviewPanelOpen);
  const [fumeroContentPreview, setFumeroContentPreview] =
    useState<FumeroContentPreviewPayload | null>(null);
  const [fumeroLivePreview, setFumeroLivePreview] =
    useState<FumeroLivePreviewPayload | null>(null);
  const [visualEditMode, setVisualEditMode] = useState(false);
  const visualEditPickRef = useRef<(hint: string) => void>(() => {});
  const uxReviewRef = useRef<() => Promise<void>>(async () => {});
  const { artifact, loading: artifactLoading, buildArtifact, closeArtifact, saveArtifact } =
    useArtifact(company);
  const {
    project,
    loading: projectLoading,
    buildProject,
    iterateProject,
    closeProject,
    saveProjectAsApp,
    loadProject,
    error: projectError,
  } = useProject(company);

  useEffect(() => {
    const id = sp.get("project");
    if (id && /^\d+$/.test(id)) {
      void loadProject(Number(id)).catch(() => {});
    }
  }, [sp, loadProject]);

  const splitContainerRef = useRef<HTMLDivElement>(null);
  const [chatPercent, setChatPercent] = useState(BUILDER_CHAT_DEFAULT_PERCENT);

  useEffect(() => {
    if (!bouwenWorkspace) return;
    const width =
      splitContainerRef.current?.getBoundingClientRect().width ?? 0;
    setChatPercent(readStoredBuilderChatPercent(window.localStorage, width));
  }, [bouwenWorkspace]);

  const applyChatPercentFromPointer = useCallback((clientX: number) => {
    const rect = splitContainerRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    setChatPercent(builderChatPercentFromPointer(clientX, rect.left, rect.width));
  }, []);

  const handleSplitterPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    []
  );

  const handleSplitterPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      applyChatPercentFromPointer(e.clientX);
    },
    [applyChatPercentFromPointer]
  );

  const handleSplitterPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
      e.currentTarget.releasePointerCapture(e.pointerId);
      persistBuilderChatPercent(window.localStorage, chatPercent);
    },
    [chatPercent]
  );

  const handleSplitterKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const width =
        splitContainerRef.current?.getBoundingClientRect().width ?? 0;
      const next = builderChatPercentFromKeyboard(chatPercent, e.key, width);
      if (next !== chatPercent) {
        e.preventDefault();
        setChatPercent(next);
        persistBuilderChatPercent(window.localStorage, next);
      }
    },
    [chatPercent]
  );

  const hasPreview = Boolean(
    artifact || project || fumeroContentPreview || fumeroLivePreview
  );
  const coderPreviewRail = fumeroCoderActive && !artifact && !project;
  const showPreviewRail = hasPreview || coderPreviewRail;
  const previewVisible = showPreviewRail && previewPanelOpen;
  const busy = artifactLoading || projectLoading;
  const stackLabel = project?.spec.stack
    ? stackDisplayName(project.spec.stack)
    : null;

  useEffect(() => {
    if (hasPreview || fumeroCoderActive) setPreviewPanelOpen(true);
  }, [hasPreview, fumeroCoderActive, setPreviewPanelOpen]);

  const bumpLivePreviewEpoch = () => {
    setFumeroLivePreview((prev) =>
      prev ? { ...prev, previewEpoch: Date.now() } : prev
    );
  };

  return (
    <div
      className={cn(
        "chat-os-workspace flex h-full min-h-0 flex-1 flex-col overflow-hidden",
        className ?? "bg-background"
      )}
    >
      <div
        ref={splitContainerRef}
        className={cn(
          "flex min-h-0 min-w-0 flex-1 flex-row",
          previewVisible && !fumeroCoderActive && "divide-x divide-[var(--os-border)]"
        )}
      >
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-col",
            bouwenWorkspace && previewVisible
              ? "min-w-[280px] flex-none"
              : "flex-1"
          )}
          style={
            bouwenWorkspace && previewVisible
              ? { width: `${chatPercent}%` }
              : undefined
          }
        >
          <MotorsChatPanel
            layout="split"
            unifiedMode
            bouwenWorkspace={bouwenWorkspace}
            initialPrompt={initialPromptProp ?? sp.get("q")}
            initialToolId={
              (() => {
                const raw = sp.get("tool");
                if (!raw || !/^\d+$/.test(raw)) return null;
                return Number(raw);
              })()
            }
            initialAppSlug={sp.get("app") || null}
            initialComposerMode={
              initialCoderMode ? ("coder" as FumeroComposerMode) : undefined
            }
            onComposerModeChange={(mode) => {
              setFumeroCoderActive(mode === "coder");
              onComposerModeChange?.(mode);
            }}
            maxCompanion={maxCompanion}
            onBuildArtifact={buildArtifact}
            onFumeroContentPreview={setFumeroContentPreview}
            onFumeroLivePreview={setFumeroLivePreview}
            onFumeroVisualEditModeChange={setVisualEditMode}
            onRegisterVisualEditPick={(fn) => {
              visualEditPickRef.current = fn;
            }}
            onRegisterUxReview={(fn) => {
              uxReviewRef.current = fn;
            }}
            onBouwenBridgeUpdate={onBouwenBridgeUpdate}
            onPublishSuccess={onPublishSuccess}
            onProjectPrompt={async (prompt, conversationId) => {
              if (project) {
                await iterateProject(prompt);
              } else {
                await buildProject(prompt, conversationId);
              }
            }}
            hasActiveProject={Boolean(project)}
            projectStack={project?.spec.stack ?? null}
            artifactBusy={busy}
            externalStatusError={projectError}
          />
        </div>

        {showPreviewRail && (
          <>
            {bouwenWorkspace && previewVisible ? (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Chat- en previewbreedte aanpassen"
                aria-valuenow={Math.round(chatPercent)}
                tabIndex={0}
                className="fumero-builder-splitter group relative z-[2] mx-0.5 w-2 shrink-0 cursor-col-resize touch-none outline-none"
                onPointerDown={handleSplitterPointerDown}
                onPointerMove={handleSplitterPointerMove}
                onPointerUp={handleSplitterPointerUp}
                onKeyDown={handleSplitterKeyDown}
              >
                <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors group-hover:bg-[#69C400]/45 group-focus-visible:bg-[#69C400]/60" />
              </div>
            ) : null}
            <PanelCollapseRail
              side="right"
              open={previewPanelOpen}
              onToggle={() => setPreviewPanelOpen(!previewPanelOpen)}
              title={
                previewPanelOpen
                  ? "Preview inklappen"
                  : "Preview uitklappen"
              }
            />
            {previewVisible && (
              <div
                className={cn(
                  "fumero-coder-preview-rail flex min-h-0 flex-1 flex-col",
                  bouwenWorkspace
                    ? "min-w-0"
                    : fumeroCoderActive
                      ? "w-[min(58%,36rem)] min-w-[300px] max-w-[60%]"
                      : "w-[min(52%,32rem)] min-w-[300px] max-w-[55%]"
                )}
              >
                {artifact && (
                  <ArtifactPanel
                    html={artifact.html}
                    title={artifact.title}
                    onClose={closeArtifact}
                    onSave={async () => {
                      await saveArtifact(artifact);
                    }}
                  />
                )}
                {project && !artifact && (
                  <ProjectPreview
                    title={project.title}
                    files={project.files}
                    previewHtml={project.previewHtml}
                    stackLabel={stackLabel}
                    klant={company}
                    onClose={closeProject}
                    onSave={async () => {
                      await saveProjectAsApp();
                    }}
                  />
                )}
                {!artifact && !project && fumeroLivePreview && (
                  <FumeroLivePreviewPanel
                    preview={fumeroLivePreview}
                    onClose={() => {
                      setFumeroLivePreview(null);
                      setVisualEditMode(false);
                    }}
                    onRefresh={bumpLivePreviewEpoch}
                    visualEditMode={visualEditMode}
                    onVisualEditPick={(hint) => visualEditPickRef.current(hint)}
                    onUxReview={() => uxReviewRef.current()}
                    uxReviewDisabled={false}
                  />
                )}
                {!artifact &&
                  !project &&
                  !fumeroLivePreview &&
                  coderPreviewRail && (
                    <FumeroLivePreviewPanel
                      preview={{
                        title: "Preview",
                        previewUrl: null,
                        status: "ready",
                        building: false,
                      }}
                      onClose={() => {
                        if (bouwenWorkspace) {
                          setPreviewPanelOpen(false);
                        } else {
                          setFumeroCoderActive(false);
                        }
                      }}
                    />
                  )}
                {!artifact && !project && !fumeroLivePreview && fumeroContentPreview && (
                  fumeroContentPreview.canvasMode ? (
                    <FumeroCanvasPanel
                      preview={fumeroContentPreview}
                      onClose={() => setFumeroContentPreview(null)}
                      onContentChange={(content) =>
                        setFumeroContentPreview((prev) =>
                          prev ? { ...prev, content } : prev
                        )
                      }
                    />
                  ) : (
                    <FumeroContentPreviewPanel
                      preview={fumeroContentPreview}
                      onClose={() => setFumeroContentPreview(null)}
                      onContentChange={(content) =>
                        setFumeroContentPreview((prev) =>
                          prev ? { ...prev, content } : prev
                        )
                      }
                    />
                  )
                )}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
