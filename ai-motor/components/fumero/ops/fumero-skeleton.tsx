import { cn } from "@/lib/utils";

/** Lightweight loading placeholder aligned with Fumero Studio tokens. */
export function FumeroSkeleton({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn("fumero-skeleton rounded-md", className)}
      aria-hidden
    />
  );
}

export function FumeroTableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-[var(--fumero-border)] last:border-0">
          <td className="px-4 py-3" colSpan={7}>
            <FumeroSkeleton className="h-4 w-full max-w-md" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function FumeroChatSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <FumeroSkeleton className="h-5 w-48" />
      <FumeroSkeleton className="h-4 w-full max-w-lg" />
      <div className="mt-4 flex flex-wrap gap-2">
        <FumeroSkeleton className="h-8 w-28 rounded-full" />
        <FumeroSkeleton className="h-8 w-32 rounded-full" />
        <FumeroSkeleton className="h-8 w-24 rounded-full" />
      </div>
      <div className="mt-auto space-y-3">
        <FumeroSkeleton className="ml-auto h-10 w-2/3 max-w-sm rounded-2xl" />
        <FumeroSkeleton className="h-10 w-1/2 max-w-xs rounded-2xl" />
      </div>
    </div>
  );
}

export function FumeroBriefingStripSkeleton() {
  return (
    <div className="shrink-0 border-b border-[var(--fumero-border)] bg-[var(--fumero-bg)] px-4 py-1.5 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <FumeroSkeleton className="h-3 w-24" />
        <FumeroSkeleton className="h-3 min-w-0 flex-1 max-w-xl" />
        <FumeroSkeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

export function FumeroAutomationListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <ul className="mb-8 space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <li
          key={i}
          className="rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-4"
        >
          <FumeroSkeleton className="mb-2 h-4 w-48" />
          <FumeroSkeleton className="h-3 w-full max-w-md" />
        </li>
      ))}
    </ul>
  );
}
