import type { Metadata } from "next";
import { requireWorkspacePage } from "@/lib/auth-guards";
import { FumeroWorkspaceRoot } from "@/components/fumero/fumero-workspace-root";

export const metadata: Metadata = {
  title: {
    default: "Fumero Studio",
    template: "%s · Fumero Studio",
  },
  description: "Fumero Studio — chat, apps, bibliotheek en shop operations.",
  icons: {
    icon: [
      { url: "/brands/fumero-favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/brands/fumero-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/brands/fumero-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "nl_NL",
    siteName: "Fumero Studio",
    title: "Fumero Studio",
    description: "Fumero Studio — chat, apps, bibliotheek en shop operations.",
    images: [
      {
        url: "/brands/fumero-og.png",
        width: 1200,
        height: 630,
        alt: "Fumero Vapes & More",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fumero Studio",
    description: "Fumero Studio — chat, apps, bibliotheek en shop operations.",
    images: ["/brands/fumero-og.png"],
  },
  appleWebApp: {
    capable: true,
    title: "Fumero Studio",
    statusBarStyle: "black-translucent",
  },
};

export default async function FumeroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireWorkspacePage("fumero");
  return <FumeroWorkspaceRoot>{children}</FumeroWorkspaceRoot>;
}
