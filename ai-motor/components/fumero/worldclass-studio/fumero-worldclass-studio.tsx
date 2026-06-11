"use client";
import { useCallback, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CreationPanel } from "@/components/fumero/worldclass-studio/creation-panel";
import { CreatiesView } from "@/components/fumero/worldclass-studio/creaties-view";
import { CanvasView } from "@/components/fumero/worldclass-studio/canvas-view";
import {
  MobileTabs,
  type MobileTab,
} from "@/components/fumero/worldclass-studio/mobile-tabs";
import {
  NavRail,
  type StudioView,
} from "@/components/fumero/worldclass-studio/nav-rail";
import { PublishDialog } from "@/components/fumero/worldclass-studio/publish-dialog";
import { ResizablePanel } from "@/components/fumero/worldclass-studio/resizable-panel";
import { ResultsWorkspace } from "@/components/fumero/worldclass-studio/results-workspace";
import { StudioTopbar } from "@/components/fumero/worldclass-studio/studio-topbar";
import { usePhotoStudioGeneration } from "@/hooks/use-photo-studio-generation";
import type { ContentStudioGridItem } from "@/lib/photo-studio/types";
import type { CompanyId } from "@/lib/types";
import "@/styles/fumero-studio-worldclass.css";
type Props = { klant: CompanyId };
export function FumeroWorldclassStudio({ klant }: Props) {
  const studio = usePhotoStudioGeneration(klant);
  const [view, setView] = useState<StudioView>("make");
  const [mobileTab, setMobileTab] = useState<MobileTab>("make");
  const [topbarMode, setTopbarMode] = useState<"make" | "edit">("make");
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishItem, setPublishItem] = useState<ContentStudioGridItem | null>(
    null,
  );
  const step = useMemo<1 | 2 | 3>(() => {
    if (studio.items.length > 0) return 2;
    if (studio.busy) return 2;
    return 1;
  }, [studio.items.length, studio.busy]);
  const handleSelectForEdit = useCallback(
    (item: ContentStudioGridItem) => {
      studio.setPrompt(item.user_prompt);
      setTopbarMode("edit");
      setView("make");
      setMobileTab("make");
    },
    [studio],
  );
  const handlePublish = useCallback(() => {
    const latest = studio.items[0] ?? null;
    setPublishItem(latest);
    setPublishOpen(true);
  }, [studio.items]);
  const showMakeWorkspace = view === "make";
  return (
    <div className="fumero-studio-worldclass h-full min-h-0">
      {" "}
      <NavRail activeView={view} onViewChange={setView} />{" "}
      <div className="wc-main">
        {" "}
        <StudioTopbar
          mode={topbarMode}
          onModeChange={setTopbarMode}
          onPublish={handlePublish}
          selectedItem={studio.items[0] ?? null}
        />{" "}
        {showMakeWorkspace ? (
          <MobileTabs active={mobileTab} onChange={setMobileTab} />
        ) : null}{" "}
        {studio.error ? (
          <div className="mx-4 flex items-center justify-between gap-2 rounded-lg border border-[var(--fumero-danger-border)] bg-[var(--fumero-danger-bg)] px-3 py-2 text-[13px] text-[var(--fumero-danger-fg)]">
            {" "}
            <span>{studio.error}</span>{" "}
            {studio.error !== "Geannuleerd." ? (
              <button
                type="button"
                className="shrink-0 rounded-md border border-[var(--fumero-danger-border)] bg-[var(--fumero-surface)] px-2 py-1 text-[12px] font-medium text-[var(--fumero-danger-fg)] hover:bg-[var(--fumero-danger-bg)]"
                onClick={() => {
                  studio.setError("");
                  void studio.generate();
                }}
              >
                {" "}
                Opnieuw proberen{" "}
              </button>
            ) : null}{" "}
          </div>
        ) : null}{" "}
        <div className="wc-workspace min-h-0 flex-1">
          {" "}
          <AnimatePresence mode="wait">
            {" "}
            {view === "make" ? (
              <motion.div
                key="make"
                className="flex min-h-0 flex-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {" "}
                <div
                  className={`flex min-h-0 shrink-0 ${mobileTab !== "make" ? "wc-panel-hidden md:flex" : ""}`}
                >
                  {" "}
                  <ResizablePanel>
                    {" "}
                    <CreationPanel
                      klant={klant}
                      studio={studio}
                      step={step}
                    />{" "}
                  </ResizablePanel>{" "}
                </div>{" "}
                <div
                  className={`wc-results min-h-0 flex-1 ${mobileTab !== "results" ? "wc-panel-hidden md:flex" : ""}`}
                >
                  {" "}
                  <ResultsWorkspace
                    klant={klant}
                    studio={studio}
                    onSelectForEdit={handleSelectForEdit}
                  />{" "}
                </div>{" "}
              </motion.div>
            ) : null}{" "}
            {view === "canvas" ? (
              <motion.div
                key="canvas"
                className="min-h-0 flex-1"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {" "}
                <CanvasView />{" "}
              </motion.div>
            ) : null}{" "}
            {view === "creaties" ? (
              <motion.div
                key="creaties"
                className="min-h-0 flex-1"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {" "}
                <CreatiesView klant={klant} studio={studio} />{" "}
              </motion.div>
            ) : null}{" "}
          </AnimatePresence>{" "}
        </div>{" "}
      </div>{" "}
      <PublishDialog
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        item={publishItem}
        klant={klant}
        onScheduled={studio.refreshLibrary}
      />{" "}
    </div>
  );
}
