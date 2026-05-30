"use client";

import { cn } from "@/lib/utils";
import type { WorkspaceId } from "@/lib/types";

const SIZES = {
  xs: "h-6 w-6",
  sm: "h-8 w-8",
  md: "h-10 w-10",
  lg: "h-14 w-14",
} as const;

/** Fumero mascot "Max" — sheet ghost with wavy bottom, oval eyes, green flat cap. */
export function GhostAvatar({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 72"
      className={className}
      aria-hidden
      role="img"
    >
      {/* Sheet body with wavy flared bottom */}
      <path
        d="M32 22
           C20 22 12 30 12 40
           V 52
           C12 56 16 58 20 54
           C24 50 28 58 32 56
           C36 58 40 50 44 54
           C48 58 52 56 52 52
           V 40
           C52 30 44 22 32 22
           Z"
        fill="#FFFFFF"
        stroke="#080808"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Flat cap dome */}
      <path
        d="M16 24
           C16 10 24 4 36 4
           C48 4 54 12 54 22
           L 50 24
           C48 16 42 10 34 10
           C26 10 20 16 18 24
           Z"
        fill="#69C400"
        stroke="#080808"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Cap brim (visor left) */}
      <path
        d="M14 24
           C10 26 8 28 6 30
           L 18 26
           Z"
        fill="#69C400"
        stroke="#080808"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Vertical oval eyes */}
      <ellipse cx="24" cy="38" rx="3.2" ry="5.2" fill="#080808" />
      <circle cx="25.4" cy="36.2" r="0.9" fill="#FFFFFF" />
      <ellipse cx="40" cy="38" rx="3.2" ry="5.2" fill="#080808" />
      <circle cx="41.4" cy="36.2" r="0.9" fill="#FFFFFF" />
      {/* Friendly U-shaped smile */}
      <path
        d="M23 47
           C23 47 26 54 32 54
           C38 54 41 47 41 47
           C41 50 38 52 32 52
           C26 52 23 50 23 47
           Z"
        fill="#FFFFFF"
        stroke="#080808"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
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
