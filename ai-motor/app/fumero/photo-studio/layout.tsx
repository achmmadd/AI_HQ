import type { Metadata } from "next";
import { FumeroPhotoStudioRoute } from "@/components/fumero/worldclass-studio/fumero-photo-studio-route";

export const metadata: Metadata = {
  title: "Studio",
  description:
    "Foto's, video en teksten — alleen content. Genereer en beheer assets in Bibliotheek.",
};

export default function FumeroPhotoStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <FumeroPhotoStudioRoute legacy={children} />;
}
