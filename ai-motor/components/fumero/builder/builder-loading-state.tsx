"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { GhostAvatar } from "@/components/AgentAvatar";
import { BUILDER_LOADING_MESSAGES } from "@/lib/fumero/builder-content";

type BuilderLoadingStateProps = {
  activeMessage?: string;
  compact?: boolean;
};

export function BuilderLoadingState({
  activeMessage,
  compact = false,
}: BuilderLoadingStateProps) {
  const reduceMotion = useReducedMotion();
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    if (activeMessage || reduceMotion) return;
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % BUILDER_LOADING_MESSAGES.length);
    }, 2800);
    return () => clearInterval(interval);
  }, [activeMessage, reduceMotion]);

  const displayMessage =
    activeMessage ?? BUILDER_LOADING_MESSAGES[messageIndex];

  if (compact) {
    return (
      <div className="builder-loading-compact">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--builder-text-secondary)]" />
        <AnimatePresence mode="wait">
          <motion.span
            key={displayMessage}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            {displayMessage}
          </motion.span>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="builder-loading-state flex flex-col items-center gap-6 p-8">
      <div className="builder-loading-icon-wrap relative flex h-16 w-16 items-center justify-center">
        <GhostAvatar
          motion={reduceMotion ? false : "bounce"}
          smoke={false}
          loadingRing={!reduceMotion}
          className="h-10 w-10"
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.p
          key={displayMessage}
          className="text-[14px] font-medium text-[var(--builder-text)]"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3 }}
        >
          {displayMessage}
        </motion.p>
      </AnimatePresence>

      <div className="w-full max-w-md space-y-3">
        <div className="builder-skeleton h-8 w-3/4 rounded-lg" />
        <div className="builder-skeleton h-4 w-full rounded-md" />
        <div className="builder-skeleton h-4 w-5/6 rounded-md" />
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="builder-skeleton h-20 rounded-xl" />
          <div className="builder-skeleton h-20 rounded-xl" />
          <div className="builder-skeleton h-20 rounded-xl" />
        </div>
        <div className="builder-skeleton mt-2 h-32 w-full rounded-xl" />
      </div>
    </div>
  );
}
