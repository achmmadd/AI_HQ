import { Construction } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export function WorkspaceStub({
  title,
  description = "Deze module is in ontwikkeling. We werken aan een volledige release.",
  action,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
}) {
  return (
    <EmptyState
      icon={Construction}
      title={title}
      description={description}
      action={action}
      className="max-w-lg"
    />
  );
}
