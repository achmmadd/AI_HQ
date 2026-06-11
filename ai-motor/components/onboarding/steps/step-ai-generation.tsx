"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2, Sparkles } from "lucide-react";
import { GENERATION_CHECKLIST } from "@/lib/onboarding-data";
import { cn } from "@/lib/utils";

type StepAiGenerationProps = {
  onComplete: () => void;
};

export function StepAiGeneration({ onComplete }: StepAiGenerationProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [completed, setCompleted] = useState<boolean[]>(
    () => GENERATION_CHECKLIST.map(() => false)
  );

  useEffect(() => {
    if (activeIndex >= GENERATION_CHECKLIST.length) {
      const t = setTimeout(onComplete, 600);
      return () => clearTimeout(t);
    }

    const timer = setTimeout(() => {
      setCompleted((prev) => {
        const next = [...prev];
        next[activeIndex] = true;
        return next;
      });
      setActiveIndex((i) => i + 1);
    }, 900);

    return () => clearTimeout(timer);
  }, [activeIndex, onComplete]);

  return (
    <div className="mx-auto w-full max-w-md">
      <div className="mb-10 text-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/20 bg-accent/10"
        >
          <Sparkles className="h-7 w-7 text-accent" aria-hidden />
        </motion.div>
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
          Je AI-werkplek wordt gebouwd
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-text-secondary">
          Even geduld — we configureren agents, kennis en workflows op maat.
        </p>
      </div>

      <ul className="space-y-3">
        {GENERATION_CHECKLIST.map((item, i) => {
          const isDone = completed[i];
          const isActive = activeIndex === i && !isDone;
          const isPending = i > activeIndex;

          return (
            <motion.li
              key={item}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                isDone
                  ? "border-accent/20 bg-accent/[0.06]"
                  : isActive
                    ? "border-[var(--onboarding-card-border-hover)] bg-[var(--onboarding-checklist-active-bg)]"
                    : "border-[var(--onboarding-card-border)] bg-[var(--onboarding-checklist-pending-bg)]"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  isDone
                    ? "bg-accent text-white"
                    : isActive
                      ? "bg-[var(--onboarding-checklist-icon-active-bg)] text-accent"
                      : "bg-[var(--onboarding-checklist-icon-bg)] text-text-secondary"
                )}
              >
                <AnimatePresence mode="wait">
                  {isDone ? (
                    <motion.span
                      key="check"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <Check className="h-4 w-4" aria-hidden />
                    </motion.span>
                  ) : isActive ? (
                    <motion.span
                      key="loader"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Loader2 className="h-4 w-4" aria-hidden />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="dot"
                      className="h-1.5 w-1.5 rounded-full bg-current opacity-40"
                    />
                  )}
                </AnimatePresence>
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  isPending ? "text-text-secondary" : "text-text-primary"
                )}
              >
                {item}
              </span>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
