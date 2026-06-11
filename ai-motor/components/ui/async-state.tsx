"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AsyncErrorStateProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
};

export function AsyncErrorState({
  title = "Er ging iets mis",
  message,
  onRetry,
  retryLabel = "Opnieuw proberen",
  className,
}: AsyncErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center rounded-2xl border border-error/25 bg-error/5 px-6 py-10 text-center",
        className
      )}
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-error/10">
        <AlertCircle className="h-5 w-5 text-error" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-text-secondary">{message}</p>
      {onRetry ? (
        <Button
          type="button"
          variant="secondary"
          className="mt-5 rounded-xl"
          onClick={onRetry}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden />
          {retryLabel}
        </Button>
      ) : null}
    </div>
  );
}

type AsyncLoadingStateProps = {
  label?: string;
  className?: string;
  children?: ReactNode;
};

export function AsyncLoadingState({
  label = "Laden…",
  className,
  children,
}: AsyncLoadingStateProps) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn("py-8", className)}
    >
      {children ?? (
        <p className="text-center text-[15px] text-text-secondary">{label}</p>
      )}
    </div>
  );
}

type AsyncEmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  className?: string;
};

export function AsyncEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: AsyncEmptyStateProps) {
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
        <Button type="button" className="mt-6 rounded-xl" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
