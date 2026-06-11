import { Suspense } from "react";
import { FumeroShell } from "@/components/fumero/fumero-shell";
import { CodeWorkspaceLayout } from "@/components/code-workspace/CodeWorkspaceLayout";

export default function FumeroCodePage() {
  return (
    <FumeroShell
      page="Code"
      flush
      hideTopbar
    >
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center fumero-text-body-sm text-[var(--fumero-text-muted)]">
            Code workspace laden…
          </div>
        }
      >
        <CodeWorkspaceLayout defaultKlant="fumero" importFrom="fumero" />
      </Suspense>
    </FumeroShell>
  );
}
