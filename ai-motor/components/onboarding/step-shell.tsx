"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

type StepShellProps = {
  stepKey: string;
  children: ReactNode;
};

const transition = { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const };

export function StepShell({ stepKey, children }: StepShellProps) {
  return (
    <motion.div
      key={stepKey}
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -28 }}
      transition={transition}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}
