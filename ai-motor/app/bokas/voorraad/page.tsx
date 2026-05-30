import { BokasShell } from "@/components/bokas/bokas-shell";
import { WorkspaceStub } from "@/components/workspace-stub";

export default function BokasVoorraadPage() {
  return (
    <BokasShell page="Voorraad">
      <WorkspaceStub title="Voorraad" description="Voorraadbeheer komt hier." />
    </BokasShell>
  );
}
