import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { readAuthSession, TOKEN_COOKIE } from "@/lib/auth-session";
import db from "@/lib/db/database";
import { runDependencyChecks } from "@/lib/dependency-checks";
import { fetchLocalExecutorHealth } from "@/lib/local-executor";
import { isOpenRouterDirectConfigured } from "@/lib/openrouter-gateway";
import { getCompanyIntegrations } from "@/lib/company-integrations";
import type { CompanyId } from "@/lib/types";

export const runtime = "nodejs";

function parseKlant(raw: string | null): CompanyId {
  const k = raw?.trim().toLowerCase();
  if (k === "bokas" || k === "fumero") return k;
  return "fumero";
}

export async function GET(req: NextRequest) {
  const klant = parseKlant(new URL(req.url).searchParams.get("klant"));
  const started = Date.now();

  const [deps, executor] = await Promise.all([
    runDependencyChecks(),
    fetchLocalExecutorHealth(),
  ]);

  const lastConversation = db
    .prepare(
      `SELECT id, title, updated_at
       FROM conversations
       WHERE klant = ?
       ORDER BY datetime(updated_at) DESC
       LIMIT 1`
    )
    .get(klant) as
    | { id: number; title: string; updated_at: string }
    | undefined;

  const usageRow = db
    .prepare(
      `SELECT
        SUM(COALESCE(prompt_tokens,0) + COALESCE(completion_tokens,0)) as total_tokens,
        SUM(COALESCE(cost_eur, cost_usd * 0.92, 0)) as total_eur
       FROM usage_logs
       WHERE date(created_at) = date('now') AND klant = ?`
    )
    .get(klant) as { total_tokens: number; total_eur: number } | undefined;

  const hasMotorDream = db
    .prepare(
      "SELECT 1 as x FROM automation_tasks WHERE task_key = ? LIMIT 1"
    )
    .get("motorsai_improve_daily");
  if (!hasMotorDream) {
    db.prepare(
      `INSERT INTO automation_tasks (
         task_key, title, description, schedule_kind, schedule_time,
         enabled, approval_required, integration
       ) VALUES (?,?,?,?,?,?,?,?)`
    ).run(
      "motorsai_improve_daily",
      "MotorAI stack verbeteren",
      "Dagelijks onderzoek: hoe MotorsAI, OpenClaw en de NUC-stack sneller en stabieler kunnen.",
      "daily",
      "07:30",
      1,
      1,
      "openclaw"
    );
  }

  const schoolSeeds: Array<{
    key: string;
    title: string;
    description: string;
    kind: string;
    time: string;
    weekday: number | null;
  }> = [
    {
      key: "motor_school_lesson_daily",
      title: "Motor School — dagles",
      description:
        "Telegram met les van vandaag (T01–T05-rotatie). Zie docs/motor-school.md. Cron: POST /api/cron/motor-school?mode=lesson",
      kind: "daily",
      time: "07:45",
      weekday: null,
    },
    {
      key: "motor_school_exam_weekly",
      title: "Motor School — weekexamen",
      description:
        "Herinnering logboek + max 1 learned fix goedkeuren. Cron: POST /api/cron/motor-school?mode=exam",
      kind: "weekly",
      time: "08:15",
      weekday: 6,
    },
  ];
  for (const s of schoolSeeds) {
    const exists = db
      .prepare("SELECT 1 as x FROM automation_tasks WHERE task_key = ? LIMIT 1")
      .get(s.key);
    if (!exists) {
      db.prepare(
        `INSERT INTO automation_tasks (
           task_key, title, description, schedule_kind, schedule_time, schedule_weekday,
           enabled, approval_required, integration
         ) VALUES (?,?,?,?,?,?,?,?,?)`
      ).run(
        s.key,
        s.title,
        s.description,
        s.kind,
        s.time,
        s.weekday,
        1,
        1,
        "openclaw"
      );
    }
  }

  const autonomyTasks = db
    .prepare(
      `SELECT task_key, title, description, schedule_kind, schedule_time, enabled
       FROM automation_tasks
       WHERE enabled = 1
       ORDER BY schedule_kind, title
       LIMIT 12`
    )
    .all() as Array<{
    task_key: string;
    title: string;
    description: string;
    schedule_kind: string;
    schedule_time: string;
    enabled: number;
  }>;

  const brainOk =
    (deps.openclaw.configured ? deps.openclaw.ok : true) &&
    (executor.configured ? executor.reachable : true) &&
    isOpenRouterDirectConfigured();

  return NextResponse.json({
    klant,
    check_ms: Date.now() - started,
    brain_ok: brainOk,
    dev_panel:
      process.env.NODE_ENV !== "production" ||
      Boolean(process.env.MOTORSAI_DEV_PANEL?.trim()) ||
      Boolean(await readAuthSession((await cookies()).get(TOKEN_COOKIE)?.value)),
    brain: {
      openclaw: {
        configured: deps.openclaw.configured,
        ok: deps.openclaw.ok,
        host: deps.openclaw.url_host,
        error: deps.openclaw.error ?? null,
      },
      executor: {
        configured: executor.configured,
        ok: executor.reachable,
        workspace: executor.health?.workspace_root ?? null,
        error: executor.error ?? null,
      },
      openrouter: { configured: isOpenRouterDirectConfigured() },
    },
    memory: {
      n8n: { ok: deps.n8n.ok, host: deps.n8n.url_host },
      qdrant: { ok: deps.qdrant.ok, host: deps.qdrant.url_host },
      ollama: { ok: deps.ollama.ok, host: deps.ollama.url_host },
      dify: { ok: deps.dify.ok, host: deps.dify.url_host },
    },
    last_conversation: lastConversation
      ? {
          id: lastConversation.id,
          title: lastConversation.title,
          updated_at: lastConversation.updated_at,
        }
      : null,
    usage_today: {
      tokens: Number(usageRow?.total_tokens) || 0,
      eur: Number(usageRow?.total_eur) || 0,
    },
    integrations: getCompanyIntegrations(klant),
    autonomy_tasks: autonomyTasks.map((t) => ({
      task_key: t.task_key,
      title: t.title,
      description: t.description,
      schedule: `${t.schedule_kind} ${t.schedule_time}`,
    })),
  });
}
