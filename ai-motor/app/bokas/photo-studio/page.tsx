"use client";

import { BokasWorkspaceRoot } from "@/components/bokas/bokas-workspace-root";
import { PhotoStudioPanel } from "@/components/photo-studio/photo-studio-panel";

export default function BokasPhotoStudioPage() {
  return (
    <BokasWorkspaceRoot>
      <main className="main-content p-6">
        <PhotoStudioPanel
          klant="bokas"
          title="Bokas Photo Studio"
          description="Menu- en gerechtfoto's — upload verbeteren of nieuwe scene via prompt."
        />
      </main>
    </BokasWorkspaceRoot>
  );
}
