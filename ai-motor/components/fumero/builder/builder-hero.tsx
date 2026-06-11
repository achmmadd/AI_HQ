"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { BUILDER_TRUST_INDICATORS } from "@/lib/fumero/builder-content";

export function BuilderHero() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.header
      className="builder-hero text-center"
      initial={reduceMotion ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    >
      <h2 className="builder-hero__title text-[clamp(1.75rem,4vw,2.25rem)] font-semibold leading-[1.1] tracking-[-0.03em]">
        Wat wil je bouwen?
      </h2>
      <p className="builder-hero__subtitle mx-auto mt-3 max-w-lg text-[15px] leading-relaxed">
        Beschrijf jouw idee en zie direct een werkende versie verschijnen.
      </p>

      <ul className="builder-hero__trust mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {BUILDER_TRUST_INDICATORS.map((item, i) => (
          <motion.li
            key={item}
            className="builder-hero__check inline-flex items-center gap-1.5 text-[13px]"
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.08, duration: 0.4 }}
          >
            <span className="builder-hero__check-icon">
              <Check className="h-2.5 w-2.5" strokeWidth={3} />
            </span>
            {item}
          </motion.li>
        ))}
      </ul>
    </motion.header>
  );
}
