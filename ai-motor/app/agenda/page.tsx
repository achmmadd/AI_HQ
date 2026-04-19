import { AppShell } from "@/components/app-shell";
import { AgendaBoard } from "@/components/agenda-board";

export default function AgendaPage() {
  return (
    <AppShell title="Agenda">
      <AgendaBoard />
    </AppShell>
  );
}
