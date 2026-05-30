import type { Metadata } from "next";
import { requireWorkspacePage } from "@/lib/auth-guards";
import { FumeroWorkspaceRoot } from "@/components/fumero/fumero-workspace-root";
import { FUMERO_THEME_BOOTSTRAP_SCRIPT } from "@/lib/fumero/theme";

export const metadata: Metadata = {
  title: {
    default: "Fumero Studio",
    template: "%s · Fumero Studio",
  },
  description: "Fumero Studio — chat, apps, bibliotheek en shop operations.",
};

export default async function FumeroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireWorkspacePage("fumero");
  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: FUMERO_THEME_BOOTSTRAP_SCRIPT }}
      />
      <FumeroWorkspaceRoot>{children}</FumeroWorkspaceRoot>
    </>
  );
}
