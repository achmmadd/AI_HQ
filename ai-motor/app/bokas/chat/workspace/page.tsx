"use client";

import { Suspense, useEffect } from "react";
import { BokasShell } from "@/components/bokas/bokas-shell";
import { MotorsChatWorkspace } from "@/components/motors-chat-workspace";
import { useCompanyStore } from "@/stores/useCompanyStore";

function WorkspaceChat() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <MotorsChatWorkspace />
    </div>
  );
}

export default function BokasChatWorkspacePage() {
  const setWorkspace = useCompanyStore((s) => s.setWorkspace);

  useEffect(() => {
    setWorkspace("bokas");
  }, [setWorkspace]);

  return (
    <BokasShell page="AI Assistent" flush>
      <Suspense
        fallback={
          <p className="flex flex-1 items-center justify-center py-8 text-sm text-[var(--text-secondary)]">
            Chat laden…
          </p>
        }
      >
        <WorkspaceChat />
      </Suspense>
    </BokasShell>
  );
}
