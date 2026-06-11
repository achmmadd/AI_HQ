"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function ScrollReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : "hidden"}
      whileInView="visible"
      viewport={{ once: true, margin: "-60px" }}
      variants={fadeUp}
      transition={{
        duration: reduceMotion ? 0 : 0.55,
        delay: reduceMotion ? 0 : delay,
        ease: [0.21, 0.47, 0.32, 0.98],
      }}
    >
      {children}
    </motion.div>
  );
}

export function GlassCard({
  className,
  children,
  glowClass,
}: {
  className?: string;
  children: ReactNode;
  glowClass?: string;
}) {
  return (
    <div className={cn("group relative overflow-hidden", className)}>
      {glowClass ? (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -inset-px rounded-[inherit] bg-gradient-to-br opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100",
            glowClass
          )}
        />
      ) : null}
      <div className="relative h-full">{children}</div>
    </div>
  );
}

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--os-text-subtle,#71717a)]">
      {children}
    </p>
  );
}

export function LandingBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 os-gradient-mesh">
      <div className="absolute inset-0 opacity-[0.025]" style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
        backgroundSize: "64px 64px",
      }} />
    </div>
  );
}

export const glassCardClass =
  "os-glass rounded-[var(--os-radius-xl)] transition-all duration-300 hover:border-[var(--os-border-strong)] hover:shadow-[var(--os-shadow-md)]";

export const primaryButtonClass =
  "h-12 gap-2 rounded-[var(--os-radius-md)] bg-[var(--os-accent)] px-8 text-base font-semibold text-black shadow-[var(--os-shadow-glow)] transition-all hover:bg-[var(--os-accent-hover)] hover:scale-[1.02] sm:h-14";

export const outlineButtonClass =
  "h-12 gap-2 rounded-[var(--os-radius-md)] border-[var(--os-border-strong)] bg-white/5 px-8 text-base font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/10 hover:scale-[1.02] sm:h-14";
