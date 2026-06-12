import type { Metadata } from "next";
import { requireWorkspacePage } from "@/lib/auth-guards";
import { FumeroWorkspaceRoot } from "@/components/fumero/fumero-workspace-root";
import { FUMERO_BRAND } from "@/lib/fumero/brand-assets";

export const metadata: Metadata = {
  title: {
    default: "Fumero Studio",
    template: "%s · Fumero Studio",
  },
  description: "Fumero Studio — chat, apps, bibliotheek en shop operations.",
  icons: {
    icon: [
      { url: FUMERO_BRAND.favicon, sizes: "32x32", type: "image/png" },
      { url: "/brands/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: FUMERO_BRAND.appleTouchIcon, sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "nl_NL",
    siteName: "Fumero Studio",
    title: "Fumero Studio",
    description: "Fumero Studio — chat, apps, bibliotheek en shop operations.",
    images: [
      {
        url: FUMERO_BRAND.og.src,
        width: FUMERO_BRAND.og.width,
        height: FUMERO_BRAND.og.height,
        alt: "Fumero",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Fumero Studio",
    description: "Fumero Studio — chat, apps, bibliotheek en shop operations.",
    images: [FUMERO_BRAND.og.src],
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
