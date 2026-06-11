"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type SelectionCardProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  selected: boolean;
  onSelect: () => void;
  index?: number;
};

export function SelectionCard({
  title,
  description,
  icon: Icon,
  selected,
  onSelect,
  index = 0,
}: SelectionCardProps) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={cn(
        "group relative flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition-colors backdrop-blur-sm",
        "border-border bg-card/60 hover:bg-muted/50",
        selected
          ? "border-accent/60 bg-accent/[0.08] shadow-[0_0_0_1px_rgba(0,113,227,0.15),0_8px_32px_rgba(0,113,227,0.12)]"
          : "hover:border-border"
      )}
    >
      <span
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors",
          selected
            ? "border-accent/30 bg-accent/15 text-accent"
            : "border-border bg-muted text-muted-foreground group-hover:text-foreground"
        )}
      >
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 pt-0.5">
        <span className="block text-[15px] font-semibold tracking-tight text-foreground">
          {title}
        </span>
        <span className="mt-1 block text-sm leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
      {selected ? (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-white"
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
        </motion.span>
      ) : null}
    </motion.button>
  );
}
