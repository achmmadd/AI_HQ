import { AppShell } from "@/components/app-shell";
import { WorkspaceStub } from "@/components/workspace-stub";

export default function TodoPage() {
  return (
    <AppShell title="Taken">
      <WorkspaceStub
        title="Taken"
        description="Takenbeheer voor MotorsAI Lab is in ontwikkeling. Gebruik ondertussen chat om acties te plannen."
        action={{ label: "Naar chat", href: "/chat" }}
      />
    </AppShell>
  );
}
