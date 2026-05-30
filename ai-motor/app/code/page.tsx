import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { CodeWorkspaceLayout } from "@/components/code-workspace/CodeWorkspaceLayout";

export default function CodePage() {
  return (
    <AppShell title="Code" flush>
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center text-text-secondary">
            Code workspace laden…
          </div>
        }
      >
        <CodeWorkspaceLayout />
      </Suspense>
    </AppShell>
  );
}
