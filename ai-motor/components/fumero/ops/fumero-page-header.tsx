import Link from "next/link";
import { Button } from "@/components/ui/button";

export function FumeroPageHeader({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: {
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  const action =
    actionLabel && actionHref ? (
      <Button asChild size="sm" className="fumero-btn-primary rounded-[var(--fumero-radius)] shadow-none">
        <Link href={actionHref}>{actionLabel}</Link>
      </Button>
    ) : actionLabel && onAction ? (
      <Button
        type="button"
        size="sm"
        className="fumero-btn-primary rounded-[var(--fumero-radius)] shadow-none"
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    ) : null;

  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="fumero-text-h1 text-[var(--fumero-text)]">
          {title}
        </h1>
        {description ? (
          <p className="fumero-text-body-sm mt-2 text-[var(--fumero-text-muted)]">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
