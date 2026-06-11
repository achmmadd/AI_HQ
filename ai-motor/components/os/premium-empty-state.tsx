"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type PremiumEmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; href: string };
  secondaryAction?: { label: string; href: string };
  illustration?: "grid" | "orbit" | "pulse";
  children?: ReactNode;
  className?: string;
};

function EmptyIllustration({ type, Icon }: { type: string; Icon: LucideIcon }) {
  return (
    <div className="relative mx-auto mb-6 flex h-32 w-32 items-center justify-center">
      <div
        className={cn(
          "absolute inset-0 rounded-full",
          type === "orbit" && "animate-[spin_20s_linear_infinite] border border-dashed border-white/10",
          type === "pulse" && "bg-[var(--os-accent-muted)] blur-2xl",
          type === "grid" && "bg-gradient-to-br from-white/5 to-transparent"
        )}
        aria-hidden
      />
      <div className="relative flex h-16 w-16 items-center justify-center rounded-[var(--os-radius-xl)] bg-[var(--os-accent-muted)] ring-1 ring-[var(--os-accent)]/20">
        <Icon className="h-7 w-7 text-[var(--os-accent)]" strokeWidth={1.5} />
      </div>
      {type === "orbit" ? (
        <>
          <span className="absolute -right-1 top-4 h-2 w-2 rounded-full bg-[var(--os-accent)] os-pulse-dot" />
          <span className="absolute bottom-2 -left-1 h-1.5 w-1.5 rounded-full bg-[var(--os-blue)]" />
        </>
      ) : null}
    </div>
  );
}

export function PremiumEmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  illustration = "grid",
  children,
  className,
}: PremiumEmptyStateProps) {
  return (
    <div
      className={cn(
        "os-glass flex flex-col items-center rounded-[var(--os-radius-xl)] px-8 py-14 text-center",
        className
      )}
    >
      <EmptyIllustration type={illustration} Icon={Icon} />
      <h3 className="text-[18px] font-semibold tracking-tight text-[var(--os-text)]">{title}</h3>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-[var(--os-text-muted)]">
        {description}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {action ? (
          <Link
            href={action.href}
            className="inline-flex h-10 items-center rounded-[var(--os-radius-md)] bg-[var(--os-accent)] px-5 text-[14px] font-semibold text-[var(--os-accent-foreground)] transition-colors hover:bg-[var(--os-accent-hover)]"
          >
            {action.label}
          </Link>
        ) : null}
        {secondaryAction ? (
          <Link
            href={secondaryAction.href}
            className="inline-flex h-10 items-center rounded-[var(--os-radius-md)] border border-[var(--os-border-strong)] px-5 text-[14px] font-medium text-[var(--os-text-muted)] transition-colors hover:bg-[var(--os-hover-overlay-strong)] hover:text-[var(--os-text)]"
          >
            {secondaryAction.label}
          </Link>
        ) : null}
      </div>
      {children}
    </div>
  );
}
