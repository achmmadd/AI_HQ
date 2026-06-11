import { BokasShell } from "@/components/bokas/bokas-shell";
import { WorkspaceStub } from "@/components/workspace-stub";

export default function BokasContentPage() {
  return (
    <BokasShell page="Content">
      <WorkspaceStub
        title="Content"
        description="Content studio voor Bokas is in ontwikkeling. Gebruik photo studio voor visuals."
        action={{ label: "Photo studio", href: "/bokas/photo-studio" }}
      />
    </BokasShell>
  );
}
