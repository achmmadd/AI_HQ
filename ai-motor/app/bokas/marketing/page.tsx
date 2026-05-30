import { BokasShell } from "@/components/bokas/bokas-shell";
import { WorkspaceStub } from "@/components/workspace-stub";

export default function BokasMarketingPage() {
  return (
    <BokasShell page="Marketing">
      <WorkspaceStub title="Bokas Marketing" description="Marketing hub komt hier." />
    </BokasShell>
  );
}
