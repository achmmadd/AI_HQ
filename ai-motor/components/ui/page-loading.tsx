import { cn } from "@/lib/utils";

export function PageLoading({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse space-y-4", className)} aria-busy aria-label="Laden">
      <div className="h-8 w-48 rounded-lg bg-muted/80" />
      <div className="h-4 w-full max-w-xl rounded bg-muted/60" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="h-20 rounded-2xl bg-muted/50" />
        <div className="h-20 rounded-2xl bg-muted/50" />
        <div className="h-20 rounded-2xl bg-muted/50" />
      </div>
      <div className="h-48 rounded-2xl bg-muted/40" />
    </div>
  );
}

export function InlineLoading({ label = "Laden…" }: { label?: string }) {
  return (
    <p className="text-sm text-text-secondary" role="status">
      {label}
    </p>
  );
}
