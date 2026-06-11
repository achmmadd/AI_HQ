"use client";

import Image from "next/image";
import { FUMERO_BRAND } from "@/lib/fumero/brand-assets";
import { cn } from "@/lib/utils";
import type { WorkspaceId } from "@/lib/types";

const SIZES = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
} as const;

/** Fumero mascot "Smokey" — sheet ghost with green trapper hat. */
export function GhostAvatar({ className }: { className?: string }) {
  return (
    <Image
      src={FUMERO_BRAND.mascot.src}
      alt={FUMERO_BRAND.mascot.alt}
      width={FUMERO_BRAND.mascot.width}
      height={FUMERO_BRAND.mascot.height}
      className={cn("object-contain", className)}
      aria-hidden
    />
  );
}

function MotorAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-xl bg-ws-accent font-bold text-white",
        className
      )}
    >
      M
    </div>
  );
}

function BokasAvatar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full bg-ws-accent font-bold text-white",
        className
      )}
    >
      B
    </div>
  );
}

export function AgentAvatar({
  workspace,
  size = "md",
  className,
}: {
  workspace: WorkspaceId | string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const dim = SIZES[size];
  const ws = workspace as WorkspaceId;

  if (ws === "fumero") {
    return <GhostAvatar className={cn(dim, className)} />;
  }
  if (ws === "bokas") {
    return <BokasAvatar className={cn(dim, "text-sm", className)} />;
  }
  return <MotorAvatar className={cn(dim, "text-sm", className)} />;
}
