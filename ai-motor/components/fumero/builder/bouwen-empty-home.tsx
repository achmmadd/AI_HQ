"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { BuilderHero } from "@/components/fumero/builder/builder-hero";
import { BuilderPromptCard } from "@/components/fumero/builder/builder-prompt-card";
import { BuilderSuggestionCards } from "@/components/fumero/builder/builder-suggestion-cards";
import { BuilderTemplateGrid } from "@/components/fumero/builder/builder-template-grid";
import {
  BuilderRecentProjects,
  type BuilderRecentProject,
} from "@/components/fumero/builder/builder-recent-projects";
import { BuilderFooterStats } from "@/components/fumero/builder/builder-footer-stats";
import { BUILDER_TEMPLATES } from "@/lib/fumero/builder-content";

const STAGGER_SPRING = { type: "spring" as const, stiffness: 300, damping: 30 };

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

const staggerItem = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: STAGGER_SPRING,
  },
};

type BouwenEmptyHomeProps = {
  promptValue: string;
  onPromptChange: (value: string) => void;
  onSubmit: (prompt: string) => void;
  onUploadClick?: () => void;
  onVoiceClick?: () => void;
  onSelectSuggestion: (prompt: string) => void;
  onContinueProject: (id: number) => void;
  recentProjects: BuilderRecentProject[];
  disabled?: boolean;
  loading?: boolean;
  listening?: boolean;
};

export function BouwenEmptyHome({
  promptValue,
  onPromptChange,
  onSubmit,
  onUploadClick,
  onVoiceClick,
  onSelectSuggestion,
  onContinueProject,
  recentProjects,
  disabled = false,
  loading = false,
  listening = false,
}: BouwenEmptyHomeProps) {
  const reduceMotion = useReducedMotion();
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [promptFocused, setPromptFocused] = useState(false);

  const filteredRecent = useMemo(
    () =>
      recentProjects
        .filter((p) => p.title.trim() !== "Nieuwe chat")
        .slice(0, 4),
    [recentProjects],
  );

  return (
    <motion.div
      className="bouwen-empty-home w-full max-w-[720px] px-1 pb-6 pt-1"
      initial={reduceMotion ? false : "hidden"}
      animate="show"
      variants={reduceMotion ? undefined : staggerContainer}
    >
      <div className="flex flex-col gap-5">
        <motion.div variants={reduceMotion ? undefined : staggerItem}>
          <BuilderHero />
        </motion.div>
        <motion.div variants={reduceMotion ? undefined : staggerItem}>
          <BuilderPromptCard
            value={promptValue}
            onChange={onPromptChange}
            onSubmit={onSubmit}
            onUploadClick={onUploadClick}
            onVoiceClick={onVoiceClick}
            disabled={disabled}
            loading={loading}
            listening={listening}
            onFocusChange={setPromptFocused}
          />
        </motion.div>
        <motion.div
          className="flex flex-col gap-5 transition-opacity duration-300"
          style={{ opacity: promptFocused && !reduceMotion ? 0.72 : 1 }}
          variants={reduceMotion ? undefined : staggerItem}
        >
          <BuilderSuggestionCards
            onSelect={onSelectSuggestion}
            disabled={disabled || loading}
          />
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] px-3.5 py-2.5 text-left transition-colors hover:border-[var(--fumero-border-strong,var(--fumero-border))] hover:bg-[var(--fumero-surface-muted)]"
            aria-expanded={templatesOpen}
            onClick={() => setTemplatesOpen((o) => !o)}
          >
            <span className="text-[13px] font-medium text-[var(--fumero-text-muted)]">
              Sjablonen:{" "}
              <span className="font-mono tabular-nums text-[var(--fumero-text)]">
                {BUILDER_TEMPLATES.length}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-[var(--fumero-text-subtle)] transition-transform ${templatesOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          {templatesOpen ? (
            <BuilderTemplateGrid
              onSelect={onSelectSuggestion}
              disabled={disabled || loading}
            />
          ) : null}
          {filteredRecent.length > 0 ? (
            <BuilderRecentProjects
              projects={filteredRecent}
              onContinue={onContinueProject}
              disabled={disabled || loading}
            />
          ) : null}
          <BuilderFooterStats />
        </motion.div>
      </div>
    </motion.div>
  );
}
