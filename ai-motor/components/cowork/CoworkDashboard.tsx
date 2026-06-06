"use client";

import { Suspense, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { CoworkTasksPanel } from "@/components/cowork/CoworkTasksPanel";
import { CoworkApprovalsInbox } from "@/components/cowork/CoworkApprovalsInbox";
import { CoworkSkillsPanel } from "@/components/cowork/CoworkSkillsPanel";
import { CoworkN8nRunsPanel } from "@/components/cowork/CoworkN8nRunsPanel";
import { CoworkBridgePanel } from "@/components/cowork/CoworkBridgePanel";
import { CoworkAuditPanel } from "@/components/cowork/CoworkAuditPanel";

export const COWORK_TABS = [
  { id: "tasks", label: "Taken" },
  { id: "approvals", label: "Goedkeuringen" },
  { id: "skills", label: "Skills" },
  { id: "n8n", label: "n8n" },
  { id: "bridge", label: "Bridge" },
  { id: "audit", label: "Audit" },
] as const;

export type CoworkTabId = (typeof COWORK_TABS)[number]["id"];

function CoworkDashboardInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const rawTab = sp.get("tab") ?? "tasks";
  const tab = COWORK_TABS.some((t) => t.id === rawTab)
    ? (rawTab as CoworkTabId)
    : "tasks";

  const setTab = useCallback(
    (id: CoworkTabId) => {
      const params = new URLSearchParams(sp.toString());
      params.set("tab", id);
      router.replace(`/cowork?${params.toString()}`);
    },
    [router, sp]
  );

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold text-text-primary">
          Cowork automation hub
        </h1>
        <p className="text-sm text-text-secondary">
          Taken, goedkeuringen, skills, n8n-runs, PC-bridge en audit — alles op
          één plek. Inbox:{" "}
          <Link href="/cowork?tab=approvals" className="text-accent hover:underline">
            Goedkeuringen
          </Link>
          . Telegram deeplinks blijven op{" "}
          <code className="text-xs">/approvals?approve=</code> (niet de sidebar).
        </p>
      </div>

      <nav
        className="flex flex-wrap gap-1 rounded-2xl border border-border bg-surface-elevated/40 p-1"
        aria-label="Cowork tabs"
      >
        {COWORK_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-text-secondary hover:bg-surface-elevated hover:text-text-primary"
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="min-h-[320px]">
        {tab === "tasks" && <CoworkTasksPanel />}
        {tab === "approvals" && <CoworkApprovalsInbox />}
        {tab === "skills" && <CoworkSkillsPanel />}
        {tab === "n8n" && <CoworkN8nRunsPanel />}
        {tab === "bridge" && <CoworkBridgePanel />}
        {tab === "audit" && <CoworkAuditPanel />}
      </div>
    </div>
  );
}

export function CoworkDashboard() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-text-secondary">Cowork laden…</p>
      }
    >
      <CoworkDashboardInner />
    </Suspense>
  );
}
