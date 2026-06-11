import { BokasShell } from "@/components/bokas/bokas-shell";
import { WorkspaceStub } from "@/components/workspace-stub";

export default function BokasMarketingPage() {
  return (
    <BokasShell page="Marketing">
      <WorkspaceStub
        title="Marketing"
        description="Marketingautomatisering voor Bokas is in ontwikkeling."
        action={{ label: "Naar Bokas chat", href: "/bokas/chat" }}
      />
    </BokasShell>
  );
}
