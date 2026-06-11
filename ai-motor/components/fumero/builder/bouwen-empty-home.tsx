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
import { cn } from "@/lib/utils";

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

const secondaryContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05, delayChildren: 0.32 },
  },
};

const secondaryItem = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
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
  const [recentOpen, setRecentOpen] = useState(false);
  const [promptFocused, setPromptFocused] = useState(false);

  const filteredRecent = useMemo(
    () =>
      recentProjects
        .filter((p) => p.title.trim() !== "Nieuwe chat")
        .slice(0, 2),
    [recentProjects],
  );

  const secondaryDimmed = promptFocused && !reduceMotion;

  return (
    <motion.div
      className="builder-empty-hero bouwen-empty-home w-full max-w-[680px] px-1"
      initial={reduceMotion ? false : "hidden"}
      animate="show"
      variants={reduceMotion ? undefined : staggerContainer}
    >
      <div className="builder-empty-hero__core flex w-full flex-col gap-4">
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
          className={cn(
            "builder-empty-secondary flex flex-col gap-3 transition-opacity duration-300",
            secondaryDimmed && "builder-empty-secondary--dimmed",
          )}
          variants={reduceMotion ? undefined : secondaryContainer}
        >
          <motion.div variants={reduceMotion ? undefined : secondaryItem}>
            <BuilderSuggestionCards
              onSelect={onSelectSuggestion}
              disabled={disabled || loading}
              variant="chips"
            />
          </motion.div>

          <motion.div
            className="builder-empty-links flex flex-wrap items-center gap-x-2 gap-y-1"
            variants={reduceMotion ? undefined : secondaryItem}
          >
            <button
              type="button"
              className="builder-empty-link"
              aria-expanded={templatesOpen}
              onClick={() => setTemplatesOpen((o) => !o)}
            >
              Sjablonen ({BUILDER_TEMPLATES.length})
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  templatesOpen && "rotate-180",
                )}
                aria-hidden
              />
            </button>

            {filteredRecent.length > 0 ? (
              <>
                <span className="builder-empty-links__sep" aria-hidden>
                  ·
                </span>
                <button
                  type="button"
                  className="builder-empty-link"
                  aria-expanded={recentOpen}
                  onClick={() => setRecentOpen((o) => !o)}
                >
                  Recente
                  <ChevronDown
                    className={cn(
                      "h-3 w-3 transition-transform",
                      recentOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>
              </>
            ) : null}
          </motion.div>

          {templatesOpen ? (
            <motion.div variants={reduceMotion ? undefined : secondaryItem}>
              <BuilderTemplateGrid
                onSelect={onSelectSuggestion}
                disabled={disabled || loading}
                compact
              />
            </motion.div>
          ) : null}

          {recentOpen && filteredRecent.length > 0 ? (
            <motion.div variants={reduceMotion ? undefined : secondaryItem}>
              <BuilderRecentProjects
                projects={filteredRecent}
                onContinue={onContinueProject}
                disabled={disabled || loading}
                compact
              />
            </motion.div>
          ) : null}

          <motion.div variants={reduceMotion ? undefined : secondaryItem}>
            <BuilderFooterStats />
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}
