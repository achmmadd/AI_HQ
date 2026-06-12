"use client";

import Image from "next/image";
import { BRAND_LOGO } from "@/lib/fumero/brand-assets";
import { cn } from "@/lib/utils";

export type LogoMotion = "idle" | "chat" | "wave" | "thinking" | "bounce";

/** @deprecated Use LogoMotion */
export type MascotMotion = LogoMotion;

export type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASS: Record<LogoSize, string> = {
  xs: "h-6 w-auto max-w-[24px]",
  sm: "h-8 w-auto max-w-[34px]",
  md: "h-10 w-auto max-w-[48px]",
  lg: "h-14 w-auto max-w-[72px]",
  xl: "h-auto w-auto max-w-[140px]",
};

const MOTION_CLASS: Record<LogoMotion, string> = {
  idle: "fumero-mascot-motion--idle",
  chat: "fumero-mascot-motion--chat",
  wave: "fumero-mascot-motion--wave",
  thinking: "fumero-mascot-motion--thinking",
  bounce: "fumero-mascot-motion--bounce",
};

const SMOKE_MOTIONS = new Set<LogoMotion>(["idle", "chat", "wave", "thinking"]);

export type LogoProps = {
  /** Visual size preset */
  size?: LogoSize;
  className?: string;
  wrapperClassName?: string;
  /** Subtle glow on dark backgrounds */
  elevate?: boolean;
  motion?: LogoMotion | false;
  animated?: boolean;
  priority?: boolean;
  /** Hide from accessibility tree (decorative contexts) */
  decorative?: boolean;
};

export function Logo({
  size = "md",
  className,
  wrapperClassName,
  elevate = false,
  motion,
  animated = false,
  priority = false,
  decorative = false,
}: LogoProps) {
  const activeMotion = motion ?? (animated ? "idle" : false);

  const image = (
    <Image
      src={BRAND_LOGO.srcSvg}
      alt={decorative ? "" : BRAND_LOGO.alt}
      width={BRAND_LOGO.width}
      height={BRAND_LOGO.height}
      priority={priority}
      unoptimized
      aria-hidden={decorative || undefined}
      className={cn(
        "object-contain object-center fumero-mascot-image",
        elevate && "fumero-mascot-image--elevate",
        SIZE_CLASS[size],
        className
      )}
    />
  );

  const content = activeMotion ? (
    <span
      className={cn(
        "fumero-mascot-motion inline-flex",
        MOTION_CLASS[activeMotion],
        activeMotion !== "bounce" &&
          SMOKE_MOTIONS.has(activeMotion) &&
          "fumero-mascot-motion--smoke"
      )}
    >
      {image}
    </span>
  ) : (
    image
  );

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        wrapperClassName
      )}
    >
      {content}
    </span>
  );
}
