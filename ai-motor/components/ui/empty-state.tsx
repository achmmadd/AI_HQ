import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description: string;
  className?: string;
  action?: { label: string; href: string };
  onRetry?: () => void;
  retryLabel?: string;
  children?: ReactNode;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  className,
  action,
  onRetry,
  retryLabel = "Opnieuw proberen",
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-2xl border border-dashed border-border/70 bg-surface/50 px-6 py-12 text-center",
        className
      )}
    >
      {Icon ? (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted/80">
          <Icon className="h-6 w-6 text-muted-foreground" aria-hidden />
        </div>
      ) : null}
      <h2 className="text-lg font-semibold tracking-tight text-text-primary">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-text-secondary">{description}</p>
      {action ? (
        <Button className="mt-6 rounded-xl" asChild>
          <Link href={action.href}>{action.label}</Link>
        </Button>
      ) : null}
      {onRetry ? (
        <Button type="button" variant="secondary" className="mt-6 rounded-xl" onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
      {children}
    </div>
  );
}
