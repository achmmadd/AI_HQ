"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Check, Monitor } from "lucide-react";
import { BUILDER_PREVIEW_FEATURES } from "@/lib/fumero/builder-content";
import {
  BuilderDeviceToggle,
  type BuilderDeviceFrame,
} from "@/components/fumero/builder/builder-device-toggle";
import { cn } from "@/lib/utils";

type BuilderPreviewEmptyProps = {
  deviceFrame: BuilderDeviceFrame;
  onDeviceChange: (frame: BuilderDeviceFrame) => void;
};

export function BuilderPreviewEmpty({
  deviceFrame,
  onDeviceChange,
}: BuilderPreviewEmptyProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="builder-preview-empty flex h-full min-h-[320px] flex-col items-center justify-center gap-6 p-8">
      <motion.div
        className="builder-preview-empty__frame relative w-full max-w-[520px]"
        initial={reduceMotion ? false : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="builder-preview-chrome">
          <div className="builder-preview-chrome__bar">
            <div className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]/80" />
            </div>
            <div className="builder-preview-chrome__url">preview.jouwdomein.nl</div>
            <BuilderDeviceToggle
              value={deviceFrame}
              onChange={onDeviceChange}
            />
          </div>

          <div
            className={cn(
              "builder-preview-empty__canvas relative flex min-h-[240px] flex-col items-center justify-center gap-4 p-8",
              deviceFrame !== "desktop" && "mx-auto max-w-[280px]",
            )}
          >
            <div className="builder-preview-empty__illustration relative">
              <motion.div
                className="builder-preview-empty__glow"
                animate={
                  reduceMotion
                    ? undefined
                    : { opacity: [0.3, 0.6, 0.3], scale: [0.9, 1.1, 0.9] }
                }
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
              <div className="builder-preview-empty__icon-wrap">
                <Monitor className="builder-text-accent h-9 w-9" strokeWidth={1.5} />
              </div>
            </div>

            <div className="text-center">
              <p className="builder-preview-empty__title">
                Live preview verschijnt hier
              </p>
              <p className="builder-preview-empty__desc">
                Zodra je begint met bouwen zie je hier direct het resultaat.
              </p>
            </div>

            <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              {BUILDER_PREVIEW_FEATURES.map((feature) => (
                <li key={feature} className="builder-preview-empty__feature">
                  <Check className="builder-text-accent h-3 w-3" strokeWidth={3} />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
