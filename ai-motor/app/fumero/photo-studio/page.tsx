"use client";

import { Suspense } from "react";
import { FumeroShell } from "@/components/fumero/fumero-shell";
import { PhotoStudioPanel } from "@/components/photo-studio/photo-studio-panel";

export default function FumeroPhotoStudioPage() {
  return (
    <FumeroShell page="Photo Studio">
      <Suspense
        fallback={
          <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
            Photo Studio laden…
          </p>
        }
      >
        <PhotoStudioPanel
          klant="fumero"
          description="Productfoto's voor de webshop — tekst naar beeld of verbeter een bestaande upload."
        />
      </Suspense>
    </FumeroShell>
  );
}
