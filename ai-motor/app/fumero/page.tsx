"use client";

import { FumeroShell } from "@/components/fumero/fumero-shell";
import { CommandCenter } from "@/components/os/command-center";

export default function FumeroCommandCenterPage() {
  return (
    <FumeroShell page="Command Center">
      <CommandCenter workspace="fumero" />
    </FumeroShell>
  );
}
