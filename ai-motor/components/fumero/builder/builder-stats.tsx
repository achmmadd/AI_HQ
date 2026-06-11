"use client";

import { motion, useReducedMotion } from "framer-motion";
import { BUILDER_STATS } from "@/lib/fumero/builder-content";

export function BuilderStats() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="builder-stats" aria-label="Platform statistieken">
      <div className="grid grid-cols-3 gap-3">
        {BUILDER_STATS.map((stat, i) => (
          <motion.div
            key={stat.label}
            className="builder-stat-card"
            initial={reduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 + i * 0.08, duration: 0.45 }}
            whileHover={reduceMotion ? undefined : { y: -2 }}
          >
            <p className="builder-stat-card__value">{stat.value}</p>
            <p className="builder-stat-card__label">{stat.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
