import { AppShell } from "@/components/app-shell";
import { AfdelingenGrid } from "@/components/afdelingen-grid";

export default function AfdelingenPage() {
  return (
    <AppShell title="Afdelingen">
      <AfdelingenGrid />
    </AppShell>
  );
}
