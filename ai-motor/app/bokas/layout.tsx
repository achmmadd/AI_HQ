import { requireWorkspacePage } from "@/lib/auth-guards";
import { BokasWorkspaceRoot } from "@/components/bokas/bokas-workspace-root";

export default async function BokasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireWorkspacePage("bokas");
  return <BokasWorkspaceRoot>{children}</BokasWorkspaceRoot>;
}
