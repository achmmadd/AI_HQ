"use client";

import { FumeroShell } from "@/components/fumero/fumero-shell";
import { FumeroBriefingProvider } from "@/components/fumero/max/fumero-briefing-provider";
import { BuilderOsShell } from "@/components/os/builder-os-shell";

/** Bouwen — AI builder workspace (chat + live preview). */
export default function FumeroBouwenPage() {
  return (
    <FumeroBriefingProvider>
      <FumeroShell page="Bouwen" flush hideTopbar immersive={false}>
        <BuilderOsShell />
      </FumeroShell>
    </FumeroBriefingProvider>
  );
}
