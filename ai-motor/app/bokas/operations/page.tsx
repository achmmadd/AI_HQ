"use client";

import { BokasShell } from "@/components/bokas/bokas-shell";
import { BokasOperationsDashboard } from "@/components/bokas/bokas-operations-dashboard";

export default function BokasOperationsPage() {
  return (
    <BokasShell page="Operaties">
      <BokasOperationsDashboard />
    </BokasShell>
  );
}
