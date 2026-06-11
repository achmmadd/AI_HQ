"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Circle,
  Clock,
  ListTodo,
  Loader2,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { OsCard, OsSection, OsBadge } from "@/components/os/os-primitives";
import type {
  CommandCenterTask,
  CommandCenterTaskStatus,
  CommandCenterTodosPayload,
} from "@/lib/fumero/command-center-todos";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<CommandCenterTaskStatus, string> = {
  open: "Open",
  in_behandeling: "In behandeling",
  wacht_goedkeuring: "Wacht op goedkeuring",
  afgerond: "Afgerond",
  genegeerd: "Genegeerd",
};

const STATUS_VARIANT: Record<
  CommandCenterTaskStatus,
  "default" | "success" | "warning" | "error" | "accent"
> = {
  open: "default",
  in_behandeling: "accent",
  wacht_goedkeuring: "warning",
  afgerond: "success",
  genegeerd: "default",
};

const PRIORITY_DOT: Record<string, string> = {
  kritiek: "bg-red-400",
  hoog: "bg-amber-400",
  normaal: "bg-[var(--os-accent)]",
  laag: "bg-[var(--os-text-subtle)]",
};

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("nl-NL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TaskRow({
  task,
  done = false,
  onStatusChange,
  busy,
}: {
  task: CommandCenterTask;
  done?: boolean;
  onStatusChange?: (id: string, status: CommandCenterTaskStatus) => void;
  busy?: string | null;
}) {
  const canAct = !done && onStatusChange && task.type === "briefing_action";

  return (
    <div className="flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--os-hover-overlay)]">
      <span
        className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", PRIORITY_DOT[task.priority])}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={task.href} className="min-w-0 flex-1 group">
            <p className="truncate text-[13px] font-medium text-[var(--os-text)] group-hover:text-[var(--os-accent)]">
              {task.title}
            </p>
          </Link>
          <OsBadge variant={STATUS_VARIANT[task.status]}>
            {STATUS_LABELS[task.status]}
          </OsBadge>
        </div>
        <p className="mt-0.5 truncate text-[11px] text-[var(--os-text-subtle)]">
          {task.source}
          {task.actor ? ` · ${task.actor}` : ""}
          {" · "}
          {formatWhen(task.completed_at ?? task.timestamp)}
        </p>
        {task.description ? (
          <p className="mt-1 line-clamp-2 text-[11px] text-[var(--os-text-muted)]">
            {task.description}
          </p>
        ) : null}
        {canAct ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={busy === task.id}
              onClick={() => onStatusChange(task.id, "in_behandeling")}
              className="rounded-md border border-[var(--os-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--os-text-muted)] hover:bg-[var(--os-hover-overlay-strong)] disabled:opacity-50"
            >
              {busy === task.id ? (
                <Loader2 className="inline h-3 w-3 animate-spin" />
              ) : (
                "Start"
              )}
            </button>
            <button
              type="button"
              disabled={busy === task.id}
              onClick={() => onStatusChange(task.id, "afgerond")}
              className="rounded-md border border-[var(--os-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--os-text-muted)] hover:bg-[var(--os-hover-overlay-strong)] disabled:opacity-50"
            >
              Afgerond
            </button>
            <button
              type="button"
              disabled={busy === task.id}
              onClick={() => onStatusChange(task.id, "genegeerd")}
              className="rounded-md border border-[var(--os-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--os-text-muted)] hover:bg-[var(--os-hover-overlay-strong)] disabled:opacity-50"
            >
              Negeren
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof ListTodo;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <Icon className="h-8 w-8 text-[var(--os-text-subtle)]" strokeWidth={1.25} />
      <p className="text-[13px] font-medium text-[var(--os-text)]">{title}</p>
      <p className="max-w-xs text-[12px] text-[var(--os-text-muted)]">{hint}</p>
    </div>
  );
}

export function FumeroCommandCenterTasks() {
  const [data, setData] = useState<CommandCenterTodosPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/fumero/command-center/todos", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Taken laden mislukt");
      setData((await res.json()) as CommandCenterTodosPayload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleStatusChange = useCallback(
    async (item_key: string, status: CommandCenterTaskStatus) => {
      setBusyId(item_key);
      try {
        const res = await fetch("/api/fumero/command-center/todos", {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ item_key, status }),
        });
        if (!res.ok) throw new Error("Status bijwerken mislukt");
        await load();
      } catch {
        /* keep list as-is */
      } finally {
        setBusyId(null);
      }
    },
    [load]
  );

  if (loading && !data) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="os-shimmer h-72 rounded-[var(--os-radius-lg)]" />
        <div className="os-shimmer h-72 rounded-[var(--os-radius-lg)]" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <OsCard className="flex flex-col items-center gap-3 py-8 text-center">
        <ShieldAlert className="h-8 w-8 text-[var(--os-text-muted)]" />
        <p className="text-sm text-[var(--os-text-muted)]">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-[var(--os-radius-md)] border border-[var(--os-border)] px-3 py-1.5 text-sm hover:bg-[var(--os-hover-overlay-strong)]"
        >
          <RefreshCw className="h-4 w-4" /> Opnieuw
        </button>
      </OsCard>
    );
  }

  const open = data?.open ?? [];
  const done = data?.done ?? [];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <OsSection
        title="Te doen"
        description={
          data
            ? `${data.counts.open} openstaand${
                data.counts.by_status.wacht_goedkeuring
                  ? ` · ${data.counts.by_status.wacht_goedkeuring} wacht op goedkeuring`
                  : ""
              }`
            : "Openstaande acties"
        }
        action={{ label: "Automatisering", href: "/fumero/automations" }}
      >
        <OsCard className="!p-0">
          <div className="flex items-center justify-between border-b border-white/[0.04] px-4 py-2">
            <div className="flex items-center gap-2 text-[12px] text-[var(--os-text-muted)]">
              <ListTodo className="h-3.5 w-3.5" />
              <span>Goedkeuringen · Studio · AI-voorstellen</span>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="text-[var(--os-text-muted)] hover:text-[var(--os-text)]"
              aria-label="Vernieuwen"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            </button>
          </div>
          {open.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Geen openstaande acties"
              hint="Goedkeuringen, automation-fouten en briefing-voorstellen verschijnen hier zodra ze klaarstaan."
            />
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {open.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onStatusChange={handleStatusChange}
                  busy={busyId}
                />
              ))}
            </div>
          )}
        </OsCard>
      </OsSection>

      <OsSection
        title="Afgerond"
        description={`Laatste ${done.length > 0 ? "30 dagen" : "periode"} · ${done.length} items`}
        action={{ label: "Studio", href: "/fumero/photo-studio" }}
      >
        <OsCard className="!p-0">
          <div className="flex items-center gap-2 border-b border-white/[0.04] px-4 py-2 text-[12px] text-[var(--os-text-muted)]">
            <Clock className="h-3.5 w-3.5" />
              <span>Goedgekeurd · automatisering · generaties</span>
          </div>
          {done.length === 0 ? (
            <EmptyState
              icon={Circle}
              title="Nog niets afgerond"
              hint="Voltooide goedkeuringen, succesvolle automatiseringen en studio-generaties verschijnen hier."
            />
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {done.slice(0, 12).map((task) => (
                <TaskRow key={task.id} task={task} done />
              ))}
            </div>
          )}
        </OsCard>
      </OsSection>
    </div>
  );
}
