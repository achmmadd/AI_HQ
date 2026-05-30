import { requireWorkspacePage } from "@/lib/auth-guards";

export default async function TodoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireWorkspacePage("personal");
  return <>{children}</>;
}
