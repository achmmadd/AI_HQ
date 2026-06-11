"use client";

import { BokasShell } from "@/components/bokas/bokas-shell";
import { CommandCenter } from "@/components/os/command-center";

export default function BokasCommandCenterPage() {
  return (
    <BokasShell page="Command Center">
      <CommandCenter workspace="bokas" />
    </BokasShell>
  );
}
