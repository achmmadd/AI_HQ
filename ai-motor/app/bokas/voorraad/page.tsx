import { BokasShell } from "@/components/bokas/bokas-shell";
import { WorkspaceStub } from "@/components/workspace-stub";

export default function BokasVoorraadPage() {
  return (
    <BokasShell page="Voorraad">
      <WorkspaceStub
        title="Voorraad"
        description="Voorraadbeheer voor Bokas is in ontwikkeling. Gebruik ondertussen chat voor vragen over voorraad."
        action={{ label: "Naar Bokas chat", href: "/bokas/chat" }}
      />
    </BokasShell>
  );
}
