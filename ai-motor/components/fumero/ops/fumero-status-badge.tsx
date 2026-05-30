import { cn } from "@/lib/utils";

export type FumeroContentStatus =
  | "draft"
  | "scheduled"
  | "approved"
  | "published"
  | "failed"
  | string;

const STYLES: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-600 border-neutral-200",
  concept: "bg-neutral-100 text-neutral-600 border-neutral-200",
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  approved: "bg-neutral-100 text-neutral-700 border-neutral-200",
  published: "bg-[rgba(105,196,0,0.1)] text-[#3d7a00] border-[rgba(105,196,0,0.25)]",
  live: "bg-[rgba(105,196,0,0.1)] text-[#3d7a00] border-[rgba(105,196,0,0.25)]",
  archived: "bg-red-50/80 text-red-600/90 border-red-200/80",
  failed: "bg-red-50 text-red-700 border-red-200",
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
