"use client";

import { Suspense } from "react";
import { FumeroShell } from "@/components/fumero/fumero-shell";
import { FumeroBibliotheek } from "@/components/fumero/features/fumero-bibliotheek";

export default function FumeroBibliotheekPage() {
  return (
    <FumeroShell page="Bibliotheek">
      <Suspense
        fallback={
          <p className="py-8 text-center text-sm text-[var(--text-secondary)]">
            Bibliotheek laden…
          </p>
        }
      >
        <FumeroBibliotheek />
      </Suspense>
    </FumeroShell>
  );
}
