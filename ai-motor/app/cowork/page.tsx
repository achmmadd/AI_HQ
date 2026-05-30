import { AppShell } from "@/components/app-shell";
import { CoworkDashboard } from "@/components/cowork/CoworkDashboard";

export default function CoworkPage() {
  return (
    <AppShell title="Cowork">
      <CoworkDashboard />
    </AppShell>
  );
}
