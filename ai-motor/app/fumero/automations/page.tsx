"use client";

import { FumeroShell } from "@/components/fumero/fumero-shell";
import { FumeroAutomationsPanel } from "@/components/fumero/features/fumero-automations-panel";

export default function FumeroAutomationsPage() {
  return (
    <FumeroShell page="Automations">
      <FumeroAutomationsPanel />
    </FumeroShell>
  );
}
