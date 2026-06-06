"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CoworkApprovalItem = {
  id: string;
  source: "approvals" | "automation_run" | "bookkeeping";
  title: string;
  description: string | null;
  status: string;
  action: string | null;
  created_at: string;
  meta?: Record<string, unknown>;
};

const SOURCE_LABEL: Record<CoworkApprovalItem["source"], string> = {
  approvals: "Goedkeuring",
  automation_run: "Automatisering",
  bookkeeping: "Boekhouding",
};

export function CoworkApprovalsInbox() {
  const [items, setItems] = useState<CoworkApprovalItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [bookkeepingOffline, setBookkeepingOffline] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/cowork/approvals", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error(await res.text());
      const json = (await res.json()) as {
        items?: CoworkApprovalItem[];
        counts?: Record<string, number>;
        bookkeeping?: { status?: string; error?: string };
      };
      setItems(json.items ?? []);
      setCounts(json.counts ?? {});
      const bk = json.bookkeeping;
      setBookkeepingOffline(
        bk?.status === "offline"
          ? bk.error ?? "Boekhoud-service is offline"
          : null
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Laden mislukt");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function resolveItem(item: CoworkApprovalItem, status: "approved" | "rejected") {
    setBusyId(item.id);
    setErr(null);
    try {
      if (item.source === "approvals" && item.meta?.approval_id != null) {
        const res = await fetch("/api/approvals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: item.meta.approval_id,
            status,
          }),
        });
        if (!res.ok) throw new Error(await res.text());
      } else if (
        item.source === "automation_run" &&
        item.meta?.run_id != null
      ) {
        const runId = item.meta.run_id;
        const path =
          status === "approved"
            ? `/api/automation/runs/${runId}/approve`
            : `/api/automation/runs/${runId}/reject`;
        const res = await fetch(path, {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) throw new Error(await res.text());
      } else if (item.source === "bookkeeping") {
        window.open("/bokas/bonnen", "_blank");
        return;
      }
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Actie mislukt");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-text-secondary">
          {loading
            ? "Laden…"
            : `${counts.total ?? items.length} openstaand${
                (counts.total ?? items.length) === 1 ? "" : "e"
              }`}
        </p>
        <Button
          type="button"
          size="touch"
          variant="secondary"
          className="rounded-xl"
          onClick={() => void load()}
        >
          Vernieuwen
        </Button>
      </div>

      {bookkeepingOffline && (
        <p
          className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
          role="status"
        >
          Bookkeeping-bot offline — bon-goedkeuringen zijn nu niet beschikbaar.
          Andere goedkeuringen werken nog wel. ({bookkeepingOffline})
        </p>
      )}

      {err && (
        <p className="rounded-xl border border-error/40 bg-error/10 px-3 py-2 text-sm text-error">
          {err}
        </p>
      )}

      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-2xl border border-border bg-surface-elevated/50 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={cn(
                    "text-xs font-medium uppercase tracking-wide",
                    item.source === "bookkeeping"
                      ? "text-accent"
                      : "text-amber-500"
                  )}
                >
                  {SOURCE_LABEL[item.source]} · {item.status}
                </p>
                <h3 className="mt-0.5 font-medium text-text-primary">
                  {item.title}
                </h3>
                {item.description && (
                  <p className="mt-1 text-xs text-text-secondary">
                    {item.description}
                  </p>
                )}
                <p className="mt-2 text-[11px] text-text-secondary">
                  {item.created_at}
                  {item.action ? ` · ${item.action}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.source === "bookkeeping" ? (
                  <Button asChild size="touch" className="rounded-xl">
                    <Link href="/bokas/bonnen">Naar bonnen</Link>
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      size="touch"
                      className="rounded-xl"
                      disabled={busyId === item.id}
                      onClick={() => void resolveItem(item, "approved")}
                    >
                      Goedkeuren
                    </Button>
                    <Button
                      type="button"
                      size="touch"
                      variant="secondary"
                      className="rounded-xl"
                      disabled={busyId === item.id}
                      onClick={() => void resolveItem(item, "rejected")}
                    >
                      Afwijzen
                    </Button>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {!loading && items.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-text-secondary">
          Geen openstaande goedkeuringen — inbox is leeg.
        </p>
      )}
    </div>
  );
}
