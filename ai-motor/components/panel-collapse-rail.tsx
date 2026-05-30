"use client";

import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";

type Side = "left" | "right";

export function PanelCollapseRail({
  side,
  open,
  onToggle,
  title,
  className,
}: {
  side: Side;
  open: boolean;
  onToggle: () => void;
  title: string;
  className?: string;
}) {
  const OpenIcon = side === "left" ? PanelLeftOpen : PanelRightOpen;
  const CloseIcon = side === "left" ? PanelLeftClose : PanelRightClose;
  const Icon = open ? CloseIcon : OpenIcon;

  return (
    <button
      type="button"
      className={cn(
        "ios-tap-highlight group flex w-7 shrink-0 flex-col items-center justify-center border-border/50 bg-surface/50 text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary",
        side === "left" ? "border-r" : "border-l",
        className
      )}
      title={title}
      aria-label={title}
      aria-expanded={open}
      onClick={onToggle}
    >
      <Icon className="h-4 w-4 opacity-80 group-hover:opacity-100" />
    </button>
  );
}
