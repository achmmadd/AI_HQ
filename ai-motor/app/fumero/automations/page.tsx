"use client";

import { Suspense } from "react";
import { FumeroShell } from "@/components/fumero/fumero-shell";
import { AutomationsOs } from "@/components/os/automations-os";

function AutomationsPageInner() {
  return (
    <FumeroShell page="Automatisering">
      <AutomationsOs />
    </FumeroShell>
  );
}

export default function FumeroAutomationsPage() {
  return (
    <Suspense
      fallback={
        <FumeroShell page="Automatisering">
          <div className="os-gradient-mesh space-y-6 p-6">
            <div className="os-shimmer h-10 w-48 rounded-lg" />
            <div className="os-shimmer h-64 rounded-[var(--os-radius-lg)]" />
          </div>
        </FumeroShell>
      }
    >
      <AutomationsPageInner />
    </Suspense>
  );
}
