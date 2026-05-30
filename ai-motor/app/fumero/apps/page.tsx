"use client";

import { FumeroShell } from "@/components/fumero/fumero-shell";
import { FumeroToolsGarage } from "@/components/fumero/features/fumero-tools-garage";

/** Apps hub — gebouwde tools, widgets en full-stack apps (garage). */
export default function FumeroAppsPage() {
  return (
    <FumeroShell
      page="Apps"
      actionLabel="Nieuw in chat"
      actionHref="/fumero/chat?mode=coder"
    >
      <FumeroToolsGarage />
    </FumeroShell>
  );
}
