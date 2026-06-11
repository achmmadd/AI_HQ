"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { BuilderHero } from "@/components/fumero/builder/builder-hero";
import { BuilderPromptCard } from "@/components/fumero/builder/builder-prompt-card";
import { BuilderSuggestionCards } from "@/components/fumero/builder/builder-suggestion-cards";
import { BuilderTemplateGrid } from "@/components/fumero/builder/builder-template-grid";
import {
  BuilderRecentProjects,
  type BuilderRecentProject,
} from "@/components/fumero/builder/builder-recent-projects";

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

  const filteredRecent = useMemo(
    () =>
      recentProjects
        .filter((p) => p.title.trim() !== "Nieuwe chat")
        .slice(0, 4),
    [recentProjects],
  );

  return (
    <motion.div
      className="bouwen-empty-home w-full max-w-3xl px-2 pb-8"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex flex-col gap-8">
        <BuilderHero />
        <BuilderPromptCard
          value={promptValue}
          onChange={onPromptChange}
          onSubmit={onSubmit}
          onUploadClick={onUploadClick}
          onVoiceClick={onVoiceClick}
          disabled={disabled}
          loading={loading}
          listening={listening}
        />
        <BuilderSuggestionCards
          onSelect={onSelectSuggestion}
          disabled={disabled || loading}
        />
        <BuilderTemplateGrid
          onSelect={onSelectSuggestion}
          disabled={disabled || loading}
        />
        {filteredRecent.length > 0 ? (
          <BuilderRecentProjects
            projects={filteredRecent}
            onContinue={onContinueProject}
            disabled={disabled || loading}
          />
        ) : null}
      </div>
    </motion.div>
  );
}
