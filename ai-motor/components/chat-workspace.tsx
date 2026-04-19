"use client";

import { useSearchParams } from "next/navigation";
import { ChatPanel } from "@/components/chat-panel";
import { ArtifactPanel } from "@/components/artifact-panel";
import { useArtifact } from "@/hooks/useArtifact";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { cn } from "@/lib/utils";

export function ChatWorkspace() {
  const sp = useSearchParams();
  const preferArtifact = sp.get("mode") === "build";
  const company = useCompanyStore((s) => s.company);
  const { artifact, loading, buildArtifact, closeArtifact, saveArtifact } =
    useArtifact(company);

  return (
    <div
      className={cn(
        "flex min-h-0 rounded-2xl border border-border bg-surface",
        "h-[calc(100vh-8.5rem)]"
      )}
    >
      <div
        className={cn(
          "min-h-0 min-w-0 flex-1",
          artifact && "max-w-[50%] border-r border-border"
        )}
      >
        <ChatPanel
          layout="split"
          preferArtifactBuilds={preferArtifact}
          onBuildArtifact={buildArtifact}
          artifactBusy={loading}
        />
      </div>
      {artifact && (
        <div className="min-h-0 w-1/2 min-w-0">
          <ArtifactPanel
            html={artifact.html}
            title={artifact.title}
            onClose={closeArtifact}
            onSave={async () => {
              await saveArtifact(artifact);
            }}
          />
        </div>
      )}
    </div>
  );
}
