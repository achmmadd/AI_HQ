"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, FolderOpen } from "lucide-react";
import { formatRelativeDate } from "@/lib/fumero/projecten-shared";

export type BuilderRecentProject = {
  id: number;
  title: string;
  updated_at: string;
};

type BuilderRecentProjectsProps = {
  projects: BuilderRecentProject[];
  onContinue: (id: number) => void;
  disabled?: boolean;
};

const THUMBNAIL_GRADIENTS = [
  "linear-gradient(135deg, #1a2a1a, #2d4a2d)",
  "linear-gradient(135deg, #1a1f2e, #2a3550)",
  "linear-gradient(135deg, #1f1a2e, #352a50)",
  "linear-gradient(135deg, #1a2e2e, #2a4545)",
];

export function BuilderRecentProjects({
  projects,
  onContinue,
  disabled = false,
}: BuilderRecentProjectsProps) {
  const reduceMotion = useReducedMotion();

  if (projects.length === 0) return null;

  return (
    <section className="builder-recent">
      <h3 className="builder-vi-label mb-4">Recente projecten</h3>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {projects.map((project, i) => (
          <motion.div
            key={project.id}
            className="builder-recent-card group"
            initial={reduceMotion ? false : { opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.06, duration: 0.4 }}
            whileHover={reduceMotion ? undefined : { y: -2 }}
          >
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl"
              style={{
                background:
                  THUMBNAIL_GRADIENTS[i % THUMBNAIL_GRADIENTS.length],
              }}
            >
              <FolderOpen className="builder-text-accent h-5 w-5 opacity-70" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-[var(--builder-text)]">
                {project.title}
              </p>
              <p className="builder-text-subtle text-[11px]">
                {formatRelativeDate(project.updated_at)}
              </p>
            </div>

            <button
              type="button"
              disabled={disabled}
              onClick={() => onContinue(project.id)}
              className="builder-recent-card__action"
            >
              Doorgaan
              <ArrowRight className="h-3 w-3" />
            </button>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
