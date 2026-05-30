"use client";

import { Suspense } from "react";
import { FumeroShell } from "@/components/fumero/fumero-shell";
import { CodeWorkspaceLayout } from "@/components/code-workspace/CodeWorkspaceLayout";

export default function FumeroCodePage() {
  return (
    <FumeroShell page="Code" flush breadcrumbs={[{ label: "Fumero Studio", href: "/fumero/chat" }]}>
      <Suspense
        fallback={
          <p className="py-8 text-center fumero-text-body-sm text-[var(--fumero-text-muted)]">
            Code workspace laden…
          </p>
        }
      >
        <CodeWorkspaceLayout defaultKlant="fumero" importFrom="fumero" />
      </Suspense>
    </FumeroShell>
  );
}
