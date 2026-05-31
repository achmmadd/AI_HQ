"use client";

import { FumeroShell } from "@/components/fumero/fumero-shell";
import { FumeroBriefingProvider } from "@/components/fumero/max/fumero-briefing-provider";
import { FumeroBouwenShell } from "@/components/fumero/features/fumero-bouwen-shell";

/** Bouwen — Lovable split workspace (chat + preview). */
export default function FumeroBouwenPage() {
  return (
    <FumeroBriefingProvider>
      <FumeroShell page="Bouwen" flush>
        <FumeroBouwenShell />
      </FumeroShell>
    </FumeroBriefingProvider>
  );
}
