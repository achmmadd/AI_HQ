"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";

export function FumeroLogoLockup({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn(compact ? "" : "px-[50px] py-[50px]", className)}>
      <Image
        src="/brands/fumero-logo.png"
        alt="Fumero Vapes & More"
        width={112}
        height={28}
        priority={compact}
        className={cn(
          "object-contain object-left",
          compact ? "h-[28px] w-auto max-w-[112px]" : "h-auto min-w-[128px]"
        )}
      />
    </div>
  );
}
