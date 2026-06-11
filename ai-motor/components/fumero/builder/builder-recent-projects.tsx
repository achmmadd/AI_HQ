"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, FolderOpen } from "lucide-react";
import { formatRelativeDate } from "@/lib/fumero/projecten-shared";

export type BuilderRecentProject = {
  id: number;
  title: string;
  updated_at: string;
  status?: "published" | "concept";
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
      <h3 className="builder-vi-label mb-3">Recente projecten</h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {projects.map((project, i) => {
          const published = project.status === "published";
          return (
            <motion.article
              key={project.id}
              className="builder-recent-card builder-recent-card--grid group"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.05, duration: 0.35 }}
              whileHover={reduceMotion ? undefined : { y: -2 }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="builder-recent-card__thumb flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
                  style={{
                    background:
                      THUMBNAIL_GRADIENTS[i % THUMBNAIL_GRADIENTS.length],
                  }}
                >
                  <FolderOpen
                    className="h-5 w-5 text-[var(--builder-text-secondary)] opacity-80"
                    strokeWidth={1.5}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-[var(--builder-text)]">
                    {project.title}
                  </p>
                  <p className="builder-vi-label mt-1 inline-flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span
                      className={
                        published
                          ? "h-1.5 w-1.5 rounded-full bg-[var(--builder-text-secondary)]"
                          : "h-1.5 w-1.5 rounded-full bg-[var(--builder-text-subtle)]"
                      }
                      aria-hidden
                    />
                    {published ? "Gepubliceerd" : "Concept"}
                    <span className="normal-case tracking-normal text-[var(--builder-text-subtle)]">
                      · {formatRelativeDate(project.updated_at)}
                    </span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={disabled}
                onClick={() => onContinue(project.id)}
                className="builder-recent-card__action w-full justify-center"
              >
                Doorgaan
                <ArrowRight className="h-3 w-3" />
              </button>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
