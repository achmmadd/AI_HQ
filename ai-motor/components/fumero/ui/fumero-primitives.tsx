import Link from "next/link";
import { cn } from "@/lib/utils";

/** Standard page gutter + max-width for Fumero content pages. */
export function FumeroPageContent({
  children,
  className,
  size = "md",
}: {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "full";
}) {
  const max =
    size === "sm"
      ? "max-w-xl"
      : size === "lg"
        ? "max-w-5xl"
        : size === "full"
          ? "max-w-none"
          : "max-w-3xl";

  return (
    <div
      className={cn(
        "fumero-page-content mx-auto w-full flex flex-col gap-6",
        max,
        className
      )}
    >
      {children}
    </div>
  );
}

export function FumeroCard({
  children,
  className,
  padding = "md",
  variant = "default",
}: {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  variant?: "default" | "muted" | "glass";
}) {
  const pad =
    padding === "none"
      ? ""
      : padding === "sm"
        ? "p-4"
        : padding === "lg"
          ? "p-8"
          : "p-6";

  return (
    <div
      className={cn(
        "fumero-card rounded-[var(--fumero-radius-lg)]",
        variant === "muted" && "fumero-card-muted",
        variant === "glass" && "fumero-glass-surface",
        pad,
        className
      )}
    >
      {children}
    </div>
  );
}

export function FumeroSection({
  title,
  description,
  action,
  children,
  className,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || description || action) && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            {title ? (
              <h2 className="fumero-text-h2 text-[var(--fumero-text)]">{title}</h2>
            ) : null}
            {description ? (
              <p className="fumero-text-body-sm mt-1 text-[var(--fumero-text-muted)]">
                {description}
              </p>
            ) : null}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function FumeroAlert({
  variant = "info",
  children,
  className,
}: {
  variant?: "info" | "success" | "warning" | "error";
  children: React.ReactNode;
  className?: string;
}) {
  const styles = {
    info: "fumero-alert-info",
    success: "fumero-alert-success",
    warning: "fumero-alert-warning",
    error: "fumero-alert-error",
  }[variant];

  return (
    <div
      className={cn(
        "fumero-alert rounded-[var(--fumero-radius)] fumero-text-body-sm px-4 py-3",
        styles,
        className
      )}
    >
      {children}
    </div>
  );
}

export function FumeroStatGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 sm:grid-cols-2 lg:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}

export function FumeroStat({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "fumero-card rounded-[var(--fumero-radius-lg)] p-4 transition-colors",
        className
      )}
    >
      <p className="fumero-text-caption text-[var(--fumero-text-subtle)]">{label}</p>
      <p className="fumero-text-h2 mt-1 tabular-nums text-[var(--fumero-text)]">{value}</p>
      {hint ? (
        <p className="fumero-text-micro mt-1 text-[var(--fumero-text-muted)]">{hint}</p>
      ) : null}
    </div>
  );
}

export function FumeroLinkButton({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "fumero-btn-primary inline-flex h-9 items-center justify-center rounded-[var(--fumero-radius)] px-4 fumero-text-body-sm font-semibold transition-colors",
        className
      )}
    >
      {children}
    </Link>
  );
}
