"use client";

import Image from "next/image";
import { FUMERO_BRAND } from "@/lib/fumero/brand-assets";
import { cn } from "@/lib/utils";

type FumeroLogoVariant = "full" | "mascot";

const ELEVATE_CLASS =
  "drop-shadow-[0_0_1px_rgba(255,255,255,0.9)] drop-shadow-[0_0_12px_rgba(255,255,255,0.35)]";

export function FumeroLogoLockup({
  className,
  compact = false,
  variant = "full",
  elevate = false,
}: {
  className?: string;
  compact?: boolean;
  variant?: FumeroLogoVariant;
  /** Boost white glow on dark backgrounds (login, dark mode). */
  elevate?: boolean;
}) {
  const isMascot = variant === "mascot";
  const asset = isMascot ? FUMERO_BRAND.mascot : FUMERO_BRAND.fullLogo;

  return (
    <div className={cn("fumero-logo-lockup", compact ? "" : "px-[50px] py-[50px]", className)}>
      <Image
        src={asset.src}
        alt={isMascot ? FUMERO_BRAND.mascot.alt : "Fumero Vapes & More"}
        width={asset.width}
        height={asset.height}
        priority={compact}
        className={cn(
          "object-contain object-left",
          elevate && ELEVATE_CLASS,
          isMascot
            ? compact
              ? "h-8 w-auto max-w-[34px]"
              : "h-auto min-w-[64px] max-w-[120px]"
            : compact
              ? "h-8 w-auto max-w-[152px]"
              : "h-auto min-w-[128px] max-w-[280px]"
        )}
      />
    </div>
  );
}
