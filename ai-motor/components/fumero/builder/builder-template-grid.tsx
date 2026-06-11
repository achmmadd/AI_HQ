"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { BUILDER_TEMPLATES } from "@/lib/fumero/builder-content";

type BuilderTemplateGridProps = {
  onSelect: (prompt: string) => void;
  disabled?: boolean;
};

export function BuilderTemplateGrid({
  onSelect,
  disabled = false,
}: BuilderTemplateGridProps) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="builder-templates">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="builder-section-title">Populaire templates</h3>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {BUILDER_TEMPLATES.map((template, i) => (
          <motion.button
            key={template.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(template.prompt)}
            className="builder-template-card group disabled:opacity-50"
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.05, duration: 0.45 }}
            whileHover={reduceMotion ? undefined : { y: -3 }}
          >
            <div
              className="builder-template-card__preview relative h-[88px] overflow-hidden"
              style={{ background: template.gradient }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl opacity-80" aria-hidden>
                  {template.icon}
                </span>
              </div>
              <div className="builder-template-card__shimmer absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            </div>

            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[14px] font-semibold text-[var(--builder-text)]">
                    {template.title}
                  </p>
                  <p className="builder-text-secondary mt-1 text-[12px] leading-relaxed">
                    {template.description}
                  </p>
                </div>
                <span className="builder-template-card__icon">
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </div>
          </motion.button>
        ))}
      </div>
    </section>
  );
}
