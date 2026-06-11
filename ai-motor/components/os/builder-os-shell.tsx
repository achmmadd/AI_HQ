"use client";

import { FumeroBouwenShell } from "@/components/fumero/features/fumero-bouwen-shell";
import { BuilderBackground } from "@/components/fumero/builder/builder-background";
import "@/styles/os-builder.css";
import "@/styles/builder-premium.css";

/** Bouwen — OS canvas shell wrapping chat + live preview builder. */
export function BuilderOsShell() {
  return (
    <div className="builder-os-shell relative flex min-h-0 flex-1 flex-col" data-os-builder="">
      <BuilderBackground />
      <FumeroBouwenShell />
    </div>
  );
}
