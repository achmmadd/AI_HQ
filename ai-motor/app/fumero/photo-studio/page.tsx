"use client";

import { Suspense } from "react";
import { FumeroShell } from "@/components/fumero/fumero-shell";
import { PhotoStudioPanel } from "@/components/photo-studio/photo-studio-panel";

export default function FumeroPhotoStudioPage() {
  return (
    <FumeroShell page="Content Studio" flush>
      <Suspense
        fallback={
          <p className="py-8 text-center fumero-text-body-sm text-[var(--fumero-text-muted)]">
            Content Studio laden…
          </p>
        }
      >
        <PhotoStudioPanel klant="fumero" title="Content Studio" />
      </Suspense>
    </FumeroShell>
  );
}
