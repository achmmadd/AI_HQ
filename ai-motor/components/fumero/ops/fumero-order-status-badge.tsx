import { cn } from "@/lib/utils";
import {
  orderStatusLabel,
  parseOrderStatus,
  type FumeroOrderStatus,
} from "@/lib/fumero/order-status";

const STYLES: Record<FumeroOrderStatus, string> = {
  nieuw:
    "bg-[var(--fumero-surface-muted)] text-[var(--fumero-text-muted)] border-[var(--fumero-border)]",
  verwerking:
    "bg-[var(--fumero-info-bg)] text-[var(--fumero-info-fg)] border-[var(--fumero-info-border)]",
  verzonden:
    "bg-[var(--fumero-success-bg)] text-[var(--fumero-success-fg)] border-[var(--fumero-success-border)]",
};

export function FumeroOrderStatusBadge({
  rawSummary,
  status,
  className,
}: {
  rawSummary?: string | null;
  status?: FumeroOrderStatus;
  className?: string;
}) {
  const key = status ?? parseOrderStatus(rawSummary);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        STYLES[key],
        className
      )}
    >
      {orderStatusLabel(key)}
    </span>
  );
}
