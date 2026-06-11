"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/* ── Glass Card ── */
export function OsCard({
  children,
  className,
  hover = false,
  glow = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glow?: boolean;
}) {
  return (
    <div
      className={cn(
        "os-glass rounded-[var(--os-radius-lg)] p-5",
        hover && "os-glass-hover cursor-pointer",
        glow && "shadow-[var(--os-shadow-glow)]",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ── Metric tile ── */
export function OsMetric({
  label,
  value,
  delta,
  icon: Icon,
  trend = "neutral",
}: {
  label: string;
  value: string | number;
  delta?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <OsCard className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-medium uppercase tracking-wider text-[var(--os-text-subtle)]">
          {label}
        </span>
        {Icon ? <Icon className="h-4 w-4 text-[var(--os-text-muted)]" strokeWidth={1.5} /> : null}
      </div>
      <p className="text-[28px] font-semibold tabular-nums tracking-tight text-[var(--os-text)]">
        {value}
      </p>
      {delta ? (
        <p
          className={cn(
            "text-[12px] font-medium",
            trend === "up" && "text-[var(--os-success)]",
            trend === "down" && "text-[var(--os-red)]",
            trend === "neutral" && "text-[var(--os-text-muted)]"
          )}
        >
          {delta}
        </p>
      ) : null}
    </OsCard>
  );
}

/* ── Status badge ── */
export function OsBadge({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: "default" | "success" | "warning" | "error" | "accent";
}) {
  const variants = {
    default: "bg-[var(--os-hover-overlay)] text-[var(--os-text-muted)] border-[var(--os-border)]",
    success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
    warning: "bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-500/25",
    error: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25",
    accent: "bg-[var(--os-accent-muted)] text-[var(--os-accent)] border-[var(--os-accent)]/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        variants[variant]
      )}
    >
      {children}
    </span>
  );
}

/* ── Section header ── */
export function OsSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight text-[var(--os-text)]">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-[13px] text-[var(--os-text-muted)]">{description}</p>
          ) : null}
        </div>
        {action ? (
          <Link
            href={action.href}
            className="text-[13px] font-medium text-[var(--os-accent)] hover:text-[var(--os-accent-hover)]"
          >
            {action.label} →
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/* ── Quick action button ── */
export function OsQuickAction({
  icon: Icon,
  label,
  description,
  href,
  onClick,
  accent = false,
}: {
  icon: LucideIcon;
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  accent?: boolean;
}) {
  const inner = (
    <>
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-[var(--os-radius-md)]",
          accent ? "bg-[var(--os-accent-muted)] text-[var(--os-accent)]" : "bg-[var(--os-hover-overlay)] text-[var(--os-text-muted)]"
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-[var(--os-text)]">{label}</p>
        {description ? (
          <p className="truncate text-[12px] text-[var(--os-text-muted)]">{description}</p>
        ) : null}
      </div>
    </>
  );

  const cls = cn(
    "os-glass os-glass-hover flex items-center gap-3 rounded-[var(--os-radius-lg)] p-4 text-left transition-all",
    accent && "border-[var(--os-accent)]/20"
  );

  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

/* ── Activity row ── */
export function OsActivityRow({
  title,
  meta,
  status,
  href,
}: {
  title: string;
  meta: string;
  status?: "success" | "error" | "pending" | "active";
  href?: string;
}) {
  const dot = {
    success: "bg-emerald-400",
    error: "bg-red-400",
    pending: "bg-amber-400",
    active: "bg-[var(--os-accent)] os-pulse-dot",
  };
  const content = (
    <div className="flex items-center gap-3 rounded-[var(--os-radius-md)] px-3 py-2.5 transition-colors hover:bg-[var(--os-hover-overlay)]">
      {status ? (
        <span className={cn("h-2 w-2 shrink-0 rounded-full", dot[status])} aria-hidden />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-[var(--os-text)]">{title}</p>
        <p className="truncate text-[11px] text-[var(--os-text-subtle)]">{meta}</p>
      </div>
    </div>
  );
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

/* ── Agent card ── */
export function OsAgentCard({
  name,
  role,
  status,
  tasksToday,
  href,
}: {
  name: string;
  role: string;
  status: "online" | "idle" | "offline";
  tasksToday?: number;
  href: string;
}) {
  const statusMap = {
    online: { label: "Actief", variant: "success" as const },
    idle: { label: "Standby", variant: "warning" as const },
    offline: { label: "Offline", variant: "default" as const },
  };
  const s = statusMap[status];
  return (
    <Link href={href}>
      <OsCard hover className="group">
        <div className="flex items-start justify-between gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-[var(--os-radius-md)] bg-gradient-to-br from-[var(--os-accent-muted)] to-transparent text-[var(--os-accent)]">
            <span className="text-lg font-bold">{name[0]}</span>
          </div>
          <OsBadge variant={s.variant}>{s.label}</OsBadge>
        </div>
        <p className="mt-3 text-[15px] font-semibold text-[var(--os-text)] group-hover:text-[var(--os-accent)]">
          {name}
        </p>
        <p className="text-[12px] text-[var(--os-text-muted)]">{role}</p>
        {tasksToday !== undefined ? (
          <p className="mt-2 text-[11px] tabular-nums text-[var(--os-text-subtle)]">
            {tasksToday} taken vandaag
          </p>
        ) : null}
      </OsCard>
    </Link>
  );
}
