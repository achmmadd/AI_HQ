"use client";

import { FumeroShell } from "@/components/fumero/fumero-shell";
import { FumeroProjectenHub } from "@/components/fumero/features/fumero-projecten-hub";

/** Projecten hub — Website | Widget | Team */
export default function FumeroProjectenPage() {
  return (
    <FumeroShell page="Projecten">
      <FumeroProjectenHub />
    </FumeroShell>
  );
}
