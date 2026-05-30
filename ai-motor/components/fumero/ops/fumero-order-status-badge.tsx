import { cn } from "@/lib/utils";
import {
  orderStatusLabel,
  parseOrderStatus,
  type FumeroOrderStatus,
} from "@/lib/fumero/order-status";

const STYLES: Record<FumeroOrderStatus, string> = {
  nieuw: "bg-neutral-100 text-neutral-600 border-neutral-200",
  verwerking: "bg-blue-50 text-blue-700 border-blue-200",
  verzonden: "bg-[rgba(105,196,0,0.1)] text-[#3d7a00] border-[rgba(105,196,0,0.25)]",
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
