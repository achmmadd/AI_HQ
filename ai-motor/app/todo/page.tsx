import { AppShell } from "@/components/app-shell";
import { WorkspaceStub } from "@/components/workspace-stub";

export default function TodoPage() {
  return (
    <AppShell title="Todo">
      <WorkspaceStub
        title="Todo"
        description="Takenlijst voor Persoonlijk Lab komt hier."
      />
    </AppShell>
  );
}
