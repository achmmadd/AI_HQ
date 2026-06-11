"use client";

import { Suspense } from "react";
import { FumeroShell } from "@/components/fumero/fumero-shell";
import { FumeroBibliotheek } from "@/components/fumero/features/fumero-bibliotheek";
import { FumeroTableSkeleton } from "@/components/fumero/ops/fumero-skeleton";

export default function FumeroBibliotheekPage() {
  return (
    <FumeroShell page="Bibliotheek">
      <Suspense fallback={<FumeroTableSkeleton rows={6} />}>
        <FumeroBibliotheek />
      </Suspense>
    </FumeroShell>
  );
}
