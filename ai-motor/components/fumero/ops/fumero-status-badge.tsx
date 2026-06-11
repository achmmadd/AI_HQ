import { cn } from "@/lib/utils";

export type FumeroContentStatus =
  | "draft"
  | "scheduled"
  | "approved"
  | "published"
  | "failed"
  | string;

const STYLES: Record<string, string> = {
  draft:
    "bg-[var(--fumero-surface-muted)] text-[var(--fumero-text-muted)] border-[var(--fumero-border)]",
  concept:
    "bg-[var(--fumero-surface-muted)] text-[var(--fumero-text-muted)] border-[var(--fumero-border)]",
  scheduled:
    "bg-[var(--fumero-info-bg)] text-[var(--fumero-info-fg)] border-[var(--fumero-info-border)]",
  approved:
    "bg-[var(--fumero-surface-muted)] text-[var(--fumero-text-muted)] border-[var(--fumero-border)]",
  published:
    "bg-[var(--fumero-success-bg)] text-[var(--fumero-success-fg)] border-[var(--fumero-success-border)]",
  live: "bg-[var(--fumero-success-bg)] text-[var(--fumero-success-fg)] border-[var(--fumero-success-border)]",
  archived:
    "bg-[var(--fumero-danger-bg)] text-[var(--fumero-danger-fg)] border-[var(--fumero-danger-border)]",
  failed:
    "bg-[var(--fumero-danger-bg)] text-[var(--fumero-danger-fg)] border-[var(--fumero-danger-border)]",
};

function label(status: string): string {
  const s = status.toLowerCase();
  if (s === "draft") return "Concept";
  if (s === "concept") return "Concept";
  if (s === "scheduled") return "Gepland";
  if (s === "approved") return "Goedgekeurd";
  if (s === "published") return "Gepubliceerd";
  if (s === "live") return "Live";
  if (s === "archived") return "Gearchiveerd";
  if (s === "failed") return "Mislukt";
  return status;
}

export function FumeroStatusBadge({
  status,
  className,
}: {
  status: FumeroContentStatus;
  className?: string;
}) {
  const key = String(status).toLowerCase();
  return (
    <span
      className={cn(
        "fumero-status-badge inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
        STYLES[key] ?? STYLES.draft,
        className
      )}
    >
      {label(key)}
    </span>
  );
}
