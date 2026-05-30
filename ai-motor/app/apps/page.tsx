"use client";

import { AppShell } from "@/components/app-shell";
import { MotorsMyWork } from "@/components/motors-my-work";

export default function AppsIndexPage() {
  return (
    <AppShell title="Mijn werk">
      <MotorsMyWork />
    </AppShell>
  );
}
