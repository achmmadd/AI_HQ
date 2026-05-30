import { requireWorkspacePage } from "@/lib/auth-guards";

export default async function AgendaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireWorkspacePage("personal");
  return <>{children}</>;
}
