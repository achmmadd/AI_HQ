import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db/database";

export const runtime = "nodejs";

export type CoworkApprovalItem = {
  id: string;
  source: "approvals" | "automation_run" | "bookkeeping";
  title: string;
  description: string | null;
  status: string;
  action: string | null;
  created_at: string;
  meta?: Record<string, unknown>;
};

function bookkeepingBase(): string {
  return (
    process.env.BOOKKEEPING_BOT_URL?.replace(/\/$/, "") ||
    "http://127.0.0.1:8001"
  );
}

async function fetchBookkeepingPending(): Promise<CoworkApprovalItem[]> {
  try {
    const res = await fetch(`${bookkeepingBase()}/health`, {
      cache: "no-store",
      signal: AbortSignal.timeout(6_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      pending_approvals?: number;
      status?: string;
    };
    const count = data.pending_approvals ?? 0;
    if (count <= 0) return [];
    return [
      {
        id: "bookkeeping:pending",
        source: "bookkeeping",
        title: `${count} bon${count === 1 ? "" : "nen"} wachten op goedkeuring`,
        description: "Bookkeeping-bot — open in Bokas bonnen of bookkeeping UI.",
        status: "pending",
        action: "bookkeeping_approve",
        created_at: new Date().toISOString(),
        meta: { pending_approvals: count, bot_status: data.status },
      },
    ];
  } catch {
    return [];
  }
}

/** Geaggregeerde inbox: approvals + automation_runs pending_approval + bookkeeping proxy. */
export async function GET(req: NextRequest) {
  const includeBookkeeping =
    new URL(req.url).searchParams.get("bookkeeping") !== "0";

  const tableApprovals = db
    .prepare(
      `SELECT id, title, description, action, status, created_at, klant, requested_by
       FROM approvals WHERE status = 'pending'
       ORDER BY datetime(created_at) DESC`
    )
    .all() as Array<{
    id: number;
    title: string;
    description: string | null;
    action: string;
    status: string;
    created_at: string;
    klant: string | null;
    requested_by: string | null;
  }>;

  const runApprovals = db
    .prepare(
      `SELECT r.id, r.created_at, r.status, t.title, t.task_key, t.integration
       FROM automation_runs r
       JOIN automation_tasks t ON t.id = r.task_id
       WHERE r.status = 'pending_approval'
       ORDER BY r.id DESC`
    )
    .all() as Array<{
    id: number;
    created_at: string;
    status: string;
    title: string;
    task_key: string;
    integration: string | null;
  }>;

  const items: CoworkApprovalItem[] = [
    ...tableApprovals.map((a) => ({
      id: `approval:${a.id}`,
      source: "approvals" as const,
      title: a.title,
      description: a.description,
      status: a.status,
      action: a.action,
      created_at: a.created_at,
      meta: {
        approval_id: a.id,
        klant: a.klant,
        requested_by: a.requested_by,
      },
    })),
    ...runApprovals.map((r) => ({
      id: `run:${r.id}`,
      source: "automation_run" as const,
      title: r.title,
      description: `${r.task_key}${r.integration ? ` · ${r.integration}` : ""}`,
      status: r.status,
      action: "automation_run_approve",
      created_at: r.created_at,
      meta: { run_id: r.id, task_key: r.task_key },
    })),
  ];

  if (includeBookkeeping) {
    const bk = await fetchBookkeepingPending();
    items.push(...bk);
  }

  items.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return NextResponse.json({
    items,
    counts: {
      total: items.length,
      approvals: tableApprovals.length,
      automation_runs: runApprovals.length,
      bookkeeping: items.filter((i) => i.source === "bookkeeping").length,
    },
  });
}
