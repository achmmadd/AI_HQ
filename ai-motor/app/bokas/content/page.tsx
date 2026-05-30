import { BokasShell } from "@/components/bokas/bokas-shell";
import { WorkspaceStub } from "@/components/workspace-stub";

export default function BokasContentPage() {
  return (
    <BokasShell page="Content">
      <WorkspaceStub title="Bokas Content" description="Content studio komt hier." />
    </BokasShell>
  );
}
