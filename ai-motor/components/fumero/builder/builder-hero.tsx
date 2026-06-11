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
      <h2 className="builder-hero__title text-[26px] font-semibold leading-tight tracking-[-0.03em] text-[var(--fumero-text)] md:text-[28px]">
        Wat wil je bouwen?
      </h2>
      <p className="builder-hero__subtitle mt-2 max-w-md text-[14px] leading-relaxed text-[var(--fumero-text-muted)]">
        Beschrijf je idee — de preview verschijnt direct rechts.
      </p>
    </motion.header>
  );
}
