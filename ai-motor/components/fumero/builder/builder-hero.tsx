"use client";

import { motion, useReducedMotion } from "framer-motion";

export function BuilderHero() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.header
      className="builder-hero text-left"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <h2 className="builder-hero__title text-[22px] font-semibold leading-tight tracking-[-0.02em] text-[var(--fumero-text)]">
        Wat wil je bouwen?
      </h2>
      <p className="builder-hero__subtitle mt-1.5 max-w-md text-[14px] leading-relaxed text-[var(--fumero-text-muted)]">
        Beschrijf je idee — preview verschijnt zodra je begint met bouwen.
      </p>
    </motion.header>
  );
}
