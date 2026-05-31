"use client";

import { BokasWorkspaceRoot } from "@/components/bokas/bokas-workspace-root";
import { PhotoStudioPanel } from "@/components/photo-studio/photo-studio-panel";

export default function BokasPhotoStudioPage() {
  return (
    <BokasWorkspaceRoot>
      <main className="main-content flex h-[calc(100vh-0px)] min-h-0 flex-col overflow-hidden p-0">
        <PhotoStudioPanel klant="bokas" title="Studio" className="h-full" />
      </main>
    </BokasWorkspaceRoot>
  );
}
