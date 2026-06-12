"use client";

import type { QualityCheckResult } from "@/lib/photo-studio/quality/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

const STATUS_ICONS = {
  pass: CheckCircle2,
  fail: XCircle,
  warn: AlertTriangle,
} as const;

function statusColor(status: QualityCheckResult["status"]) {
  if (status === "pass") return "text-emerald-600";
  if (status === "fail") return "text-red-600";
  return "text-amber-600";
}

export function QualityBadges({
  checks,
  compact = false,
  className,
}: {
  checks: QualityCheckResult[];
  compact?: boolean;
  className?: string;
}) {
  if (!checks.length) {
    return (
      <span className={cn("fumero-text-caption text-[var(--fumero-text-muted)]", className)}>
        Geen kwaliteitschecks
      </span>
    );
  }

  const failCount = checks.filter((c) => c.status === "fail").length;
  const warnCount = checks.filter((c) => c.status === "warn").length;
  const overall = failCount > 0 ? "fail" : warnCount > 0 ? "warn" : "pass";

  if (compact) {
    const Icon = STATUS_ICONS[overall === "fail" ? "fail" : overall === "warn" ? "warn" : "pass"];
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 fumero-text-caption font-medium",
          overall === "pass" && "bg-emerald-50 text-emerald-700",
          overall === "warn" && "bg-amber-50 text-amber-700",
          overall === "fail" && "bg-red-50 text-red-700",
          className
        )}
      >
        <Icon className="h-3 w-3" />
        {overall === "pass" ? "PASS" : overall === "warn" ? "WARN" : "FAIL"}
      </span>
    );
  }

  return (
    <ul className={cn("space-y-1", className)}>
      {checks.map((check) => {
        const Icon = STATUS_ICONS[check.status];
        return (
          <li
            key={check.id}
            className="flex items-start gap-2 fumero-text-caption text-[var(--fumero-text-muted)]"
          >
            <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", statusColor(check.status))} />
            <span>
              <strong className="text-[var(--fumero-text)]">{check.criterion}:</strong>{" "}
              {check.message}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function QualitySummaryBadge({
  pass,
  className,
}: {
  pass: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 fumero-text-caption font-semibold",
        pass ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
        className
      )}
    >
      {pass ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      {pass ? "Kwaliteit OK" : "Check nodig"}
    </span>
  );
}
