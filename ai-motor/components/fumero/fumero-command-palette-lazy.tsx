"use client";

import dynamic from "next/dynamic";

export const FumeroCommandPaletteLazy = dynamic(
  () => import("@/components/fumero/fumero-command-palette"),
  { ssr: false }
);
