"use client";

import { motion, useReducedMotion } from "framer-motion";

/** Ambient AI-inspired background — theme-aware via builder-premium.css */
export function BuilderBackground() {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className="builder-ambient-bg pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div className="builder-ambient-base absolute inset-0" />

      <motion.div
        className="builder-ambient-glow builder-ambient-glow--center absolute left-1/2 top-[20%] h-[600px] w-[800px] -translate-x-1/2 rounded-full"
        animate={
          reduceMotion
            ? undefined
            : {
                opacity: [0.4, 0.65, 0.4],
                scale: [1, 1.05, 1],
              }
        }
        transition={{
          duration: 8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="builder-ambient-glow builder-ambient-glow--left absolute -left-32 top-[40%] h-[400px] w-[400px] rounded-full"
        animate={
          reduceMotion
            ? undefined
            : {
                opacity: [0.15, 0.3, 0.15],
                x: [0, 20, 0],
              }
        }
        transition={{
          duration: 12,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <motion.div
        className="builder-ambient-glow builder-ambient-glow--right absolute -right-24 top-[60%] h-[350px] w-[350px] rounded-full"
        animate={
          reduceMotion
            ? undefined
            : {
                opacity: [0.1, 0.25, 0.1],
                x: [0, -15, 0],
              }
        }
        transition={{
          duration: 10,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 2,
        }}
      />

      <div className="builder-ambient-grid absolute inset-0 opacity-[0.03]" />
    </div>
  );
}
