import db from "@/lib/db/database";
import { FUMERO_TASK_KEYS } from "@/lib/fumero/automation-task-keys";
import { ensurePhotoStudioSchema } from "@/lib/photo-studio/db-migrate";
import { ensureFumeroSchema } from "@/lib/fumero/db-migrate";

export type CommandCenterTaskType =
  | "approval"
  | "automation_failure"
  | "automation_pending"
  | "briefing_action"
  | "content_draft"
  | "studio"
  | "todo";

export type CommandCenterTaskStatus =
  | "open"
  | "in_behandeling"
  | "wacht_goedkeuring"
  | "afgerond"
  | "genegeerd";

export type CommandCenterTaskPriority = "kritiek" | "hoog" | "normaal" | "laag";

export type CommandCenterTask = {
  id: string;
  type: CommandCenterTaskType;
  title: string;
  description?: string;
  priority: CommandCenterTaskPriority;
  status: CommandCenterTaskStatus;
  href: string;
  source: string;
  actor?: string;
  timestamp: string;
  completed_at?: string;
};

export type CommandCenterTodosPayload = {
  open: CommandCenterTask[];
  done: CommandCenterTask[];
  counts: {
    open: number;
    done: number;
    by_status: Record<CommandCenterTaskStatus, number>;
  };
  generated_at: string;
};

const FUMERO_TASK_KEY_LIST = [...FUMERO_TASK_KEYS];
const DONE_DAYS = 30;

const PRIORITY_RANK: Record<CommandCenterTaskPriority, number> = {
  kritiek: 1,
  hoog: 2,
  normaal: 3,
  laag: 4,
};

const OPEN_STATUSES = new Set<CommandCenterTaskStatus>([
  "open",
  "in_behandeling",
  "wacht_goedkeuring",
]);

type TaskStateRow = {
  item_key: string;
  status: string;
  actor: string | null;
  completed_at: string | null;
  updated_at: string;
};

function fumeroTaskPlaceholders(): string {
  return FUMERO_TASK_KEY_LIST.map(() => "?").join(",");
}

export function sortCommandCenterTasks(tasks: CommandCenterTask[]): CommandCenterTask[] {
  return [...tasks].sort((a, b) => {
    const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (pr !== 0) return pr;
    return Date.parse(b.timestamp) - Date.parse(a.timestamp);
  });
}

export function applyTaskState(
  task: CommandCenterTask,
  state?: TaskStateRow
): CommandCenterTask | null {
  if (!state) return task;
  const status = state.status as CommandCenterTaskStatus;
  if (status === "genegeerd") return null;
  return {
    ...task,
    status,
    actor: state.actor ?? task.actor,
    completed_at: state.completed_at ?? task.completed_at,
  };
}

function loadTaskStates(klant: string): Map<string, TaskStateRow> {
  const rows = db
    .prepare(
      `SELECT item_key, status, actor, completed_at, updated_at
       FROM command_center_task_states
       WHERE klant = ?`
    )
    .all(klant) as TaskStateRow[];
  return new Map(rows.map((r) => [r.item_key, r]));
}

function collectOpenApprovals(states: Map<string, TaskStateRow>): CommandCenterTask[] {
  const rows = db
    .prepare(
      `SELECT id, title, description, action, requested_by, created_at
       FROM approvals
       WHERE status = 'pending'
       ORDER BY datetime(created_at) DESC
       LIMIT 20`
    )
    .all() as Array<{
    id: number;
    title: string;
    description: string | null;
    action: string;
    requested_by: string;
    created_at: string;
  }>;

  const tasks: CommandCenterTask[] = [];
  for (const row of rows) {
    const id = `approval:${row.id}`;
    const base: CommandCenterTask = {
      id,
      type: "approval",
      title: row.title,
      description: row.description ?? row.action,
      priority: "hoog",
      status: "wacht_goedkeuring",
      href: `/approvals?approve=${row.id}`,
      source: "Goedkeuring",
      actor: row.requested_by,
      timestamp: row.created_at,
    };
    const merged = applyTaskState(base, states.get(id));
    if (merged && OPEN_STATUSES.has(merged.status)) tasks.push(merged);
  }
  return tasks;
}

function collectAutomationTasks(states: Map<string, TaskStateRow>): CommandCenterTask[] {
  const placeholders = fumeroTaskPlaceholders();
  const rows = db
    .prepare(
      `SELECT r.id, r.status, r.detail, r.error_message, r.created_at,
              t.task_key, t.title
       FROM automation_runs r
       JOIN automation_tasks t ON t.id = r.task_id
       WHERE t.task_key IN (${placeholders})
         AND r.status IN ('failed', 'pending_approval')
         AND datetime(r.created_at) > datetime('now', '-14 days')
       ORDER BY r.id DESC
       LIMIT 15`
    )
    .all(...FUMERO_TASK_KEY_LIST) as Array<{
    id: number;
    status: string;
    detail: string | null;
    error_message: string | null;
    created_at: string;
    task_key: string;
    title: string;
  }>;

  const tasks: CommandCenterTask[] = [];
  for (const row of rows) {
    const isPending = row.status === "pending_approval";
    const id = isPending ? `automation_pending:${row.id}` : `automation_failed:${row.id}`;
    const base: CommandCenterTask = {
      id,
      type: isPending ? "automation_pending" : "automation_failure",
      title: isPending
        ? `Automation wacht op goedkeuring: ${row.title}`
        : `Automation mislukt: ${row.title}`,
      description: row.error_message ?? row.detail ?? undefined,
      priority: isPending ? "hoog" : "kritiek",
      status: isPending ? "wacht_goedkeuring" : "open",
      href: "/fumero/automations",
      source: "Automatisering",
      timestamp: row.created_at,
    };
    const merged = applyTaskState(base, states.get(id));
    if (merged && OPEN_STATUSES.has(merged.status)) tasks.push(merged);
  }
  return tasks;
}

function collectContentDrafts(states: Map<string, TaskStateRow>): CommandCenterTask[] {
  const rows = db
    .prepare(
      `SELECT id, platform, content, created_at
       FROM content_posts
       WHERE klant = 'fumero' AND status = 'draft'
       ORDER BY datetime(created_at) DESC
       LIMIT 10`
    )
    .all() as Array<{
    id: number;
    platform: string;
    content: string;
    created_at: string;
  }>;

  const tasks: CommandCenterTask[] = [];
  for (const row of rows) {
    const id = `content_draft:${row.id}`;
    const preview = row.content.trim().slice(0, 80);
    const base: CommandCenterTask = {
      id,
      type: "content_draft",
      title: `Content draft (${row.platform})`,
      description: preview.length < row.content.length ? `${preview}…` : preview,
      priority: "normaal",
      status: "open",
      href: "/fumero/bibliotheek",
      source: "Studio content",
      timestamp: row.created_at,
    };
    const merged = applyTaskState(base, states.get(id));
    if (merged && OPEN_STATUSES.has(merged.status)) tasks.push(merged);
  }
  return tasks;
}

function collectBriefingActions(states: Map<string, TaskStateRow>): CommandCenterTask[] {
  const row = db
    .prepare(
      `SELECT actions_json, created_at
       FROM fumero_briefings
       ORDER BY id DESC
       LIMIT 1`
    )
    .get() as { actions_json: string; created_at: string } | undefined;
  if (!row) return [];

  let actions: string[] = [];
  try {
    actions = JSON.parse(row.actions_json || "[]") as string[];
  } catch {
    actions = [];
  }

  const tasks: CommandCenterTask[] = [];
  actions.slice(0, 5).forEach((action, index) => {
    const text = String(action).trim();
    if (!text) return;
    const id = `briefing_action:${index}`;
    const base: CommandCenterTask = {
      id,
      type: "briefing_action",
      title: text,
      description: "Smokey ochtendbriefing — afdeling-AI voorstel",
      priority: "normaal",
      status: "open",
      href: "/fumero/chat",
      source: "Afdeling-AI",
      actor: "Smokey",
      timestamp: row.created_at,
    };
    const merged = applyTaskState(base, states.get(id));
    if (merged && OPEN_STATUSES.has(merged.status)) tasks.push(merged);
  });
  return tasks;
}

function collectManualTodos(states: Map<string, TaskStateRow>): CommandCenterTask[] {
  const rows = db
    .prepare(
      `SELECT id, title, description, priority, status, source, created_at
       FROM todos
       WHERE klant = 'fumero' AND status IN ('open', 'in_behandeling')
       ORDER BY datetime(created_at) DESC
       LIMIT 15`
    )
    .all() as Array<{
    id: number;
    title: string;
    description: string | null;
    priority: string;
    status: string;
    source: string;
    created_at: string;
  }>;

  const tasks: CommandCenterTask[] = [];
  for (const row of rows) {
    const id = `todo:${row.id}`;
    const priority = (
      ["kritiek", "hoog", "normaal", "laag"].includes(row.priority)
        ? row.priority
        : "normaal"
    ) as CommandCenterTaskPriority;
    const status = (
      row.status === "in_behandeling" ? "in_behandeling" : "open"
    ) as CommandCenterTaskStatus;
    const base: CommandCenterTask = {
      id,
      type: "todo",
      title: row.title,
      description: row.description ?? undefined,
      priority,
      status,
      href: "/fumero",
      source: row.source || "Handmatig",
      timestamp: row.created_at,
    };
    const merged = applyTaskState(base, states.get(id));
    if (merged && OPEN_STATUSES.has(merged.status)) tasks.push(merged);
  }
  return tasks;
}

function collectDoneItems(states: Map<string, TaskStateRow>): CommandCenterTask[] {
  const placeholders = fumeroTaskPlaceholders();
  const tasks: CommandCenterTask[] = [];

  const approvals = db
    .prepare(
      `SELECT id, title, status, requested_by, resolved_at, created_at
       FROM approvals
       WHERE status IN ('approved', 'rejected')
         AND resolved_at IS NOT NULL
         AND datetime(resolved_at) > datetime('now', '-${DONE_DAYS} days')
       ORDER BY datetime(resolved_at) DESC
       LIMIT 15`
    )
    .all() as Array<{
    id: number;
    title: string;
    status: string;
    requested_by: string;
    resolved_at: string;
    created_at: string;
  }>;

  for (const row of approvals) {
    tasks.push({
      id: `approval_done:${row.id}`,
      type: "approval",
      title: row.title,
      description: row.status === "approved" ? "Goedgekeurd" : "Afgewezen",
      priority: "normaal",
      status: "afgerond",
      href: "/approvals",
      source: "Goedkeuring",
      actor: row.requested_by,
      timestamp: row.resolved_at,
      completed_at: row.resolved_at,
    });
  }

  const runs = db
    .prepare(
      `SELECT r.id, r.detail, r.finished_at, t.title, t.task_key
       FROM automation_runs r
       JOIN automation_tasks t ON t.id = r.task_id
       WHERE t.task_key IN (${placeholders})
         AND r.status = 'success'
         AND r.finished_at IS NOT NULL
         AND datetime(r.finished_at) > datetime('now', '-${DONE_DAYS} days')
       ORDER BY datetime(r.finished_at) DESC
       LIMIT 15`
    )
    .all(...FUMERO_TASK_KEY_LIST) as Array<{
    id: number;
    detail: string | null;
    finished_at: string;
    title: string;
    task_key: string;
  }>;

  for (const row of runs) {
    tasks.push({
      id: `automation_success:${row.id}`,
      type: "automation_failure",
      title: `Automation voltooid: ${row.title}`,
      description: row.detail ?? undefined,
      priority: "laag",
      status: "afgerond",
      href: "/fumero/automations",
      source: "Automatisering",
      timestamp: row.finished_at,
      completed_at: row.finished_at,
    });
  }

  ensurePhotoStudioSchema();
  const generations = db
    .prepare(
      `SELECT id, mode, user_prompt, prompt, created_at
       FROM photo_studio_generations
       WHERE klant = 'fumero'
         AND datetime(created_at) > datetime('now', '-${DONE_DAYS} days')
       ORDER BY datetime(created_at) DESC
       LIMIT 10`
    )
    .all() as Array<{
    id: number;
    mode: string;
    user_prompt: string | null;
    prompt: string;
    created_at: string;
  }>;

  for (const row of generations) {
    const label =
      (row.user_prompt?.trim() || row.prompt.trim()).slice(0, 72) || row.mode;
    tasks.push({
      id: `studio_gen:${row.id}`,
      type: "studio",
      title: `Studio generatie (${row.mode})`,
      description: label,
      priority: "laag",
      status: "afgerond",
      href: "/fumero/photo-studio",
      source: "Photo Studio",
      actor: "Studio",
      timestamp: row.created_at,
      completed_at: row.created_at,
    });
  }

  const posts = db
    .prepare(
      `SELECT id, platform, content, status, published_at, created_at
       FROM content_posts
       WHERE klant = 'fumero'
         AND status IN ('approved', 'published')
         AND datetime(COALESCE(published_at, created_at)) > datetime('now', '-${DONE_DAYS} days')
       ORDER BY datetime(COALESCE(published_at, created_at)) DESC
       LIMIT 10`
    )
    .all() as Array<{
    id: number;
    platform: string;
    content: string;
    status: string;
    published_at: string | null;
    created_at: string;
  }>;

  for (const row of posts) {
    const ts = row.published_at ?? row.created_at;
    const preview = row.content.trim().slice(0, 72);
    tasks.push({
      id: `content_done:${row.id}`,
      type: "content_draft",
      title: `Content ${row.status} (${row.platform})`,
      description: preview,
      priority: "laag",
      status: "afgerond",
      href: "/fumero/bibliotheek",
      source: "Studio content",
      timestamp: ts,
      completed_at: ts,
    });
  }

  for (const state of states.values()) {
    if (state.status !== "afgerond" || !state.completed_at) continue;
    if (
      state.item_key.startsWith("approval_done:") ||
      state.item_key.startsWith("automation_success:") ||
      state.item_key.startsWith("studio_gen:") ||
      state.item_key.startsWith("content_done:")
    ) {
      continue;
    }
    tasks.push({
      id: state.item_key,
      type: "briefing_action",
      title: state.item_key.replace(/^[^:]+:/, "Taak "),
      priority: "normaal",
      status: "afgerond",
      href: "/fumero",
      source: "Command Center",
      actor: state.actor ?? undefined,
      timestamp: state.completed_at,
      completed_at: state.completed_at,
    });
  }

  return sortCommandCenterTasks(tasks).slice(0, 30);
}

export function buildCommandCenterTodos(klant = "fumero"): CommandCenterTodosPayload {
  ensureFumeroSchema();
  const states = loadTaskStates(klant);

  const open = sortCommandCenterTasks([
    ...collectOpenApprovals(states),
    ...collectAutomationTasks(states),
    ...collectContentDrafts(states),
    ...collectBriefingActions(states),
    ...collectManualTodos(states),
  ]);

  const done = collectDoneItems(states);

  const by_status: Record<CommandCenterTaskStatus, number> = {
    open: 0,
    in_behandeling: 0,
    wacht_goedkeuring: 0,
    afgerond: 0,
    genegeerd: 0,
  };
  for (const t of open) {
    by_status[t.status] = (by_status[t.status] ?? 0) + 1;
  }

  return {
    open,
    done,
    counts: {
      open: open.length,
      done: done.length,
      by_status,
    },
    generated_at: new Date().toISOString(),
  };
}

export function updateCommandCenterTaskState(opts: {
  klant?: string;
  item_key: string;
  status: CommandCenterTaskStatus;
  actor?: string;
}): CommandCenterTask | null {
  ensureFumeroSchema();
  const klant = opts.klant ?? "fumero";
  const completed_at =
    opts.status === "afgerond" || opts.status === "genegeerd"
      ? new Date().toISOString()
      : null;

  db.prepare(
    `INSERT INTO command_center_task_states (klant, item_key, status, actor, completed_at, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(item_key) DO UPDATE SET
       status = excluded.status,
       actor = excluded.actor,
       completed_at = excluded.completed_at,
       updated_at = datetime('now')`
  ).run(klant, opts.item_key, opts.status, opts.actor ?? null, completed_at);

  if (opts.item_key.startsWith("todo:")) {
    const todoId = parseInt(opts.item_key.replace("todo:", ""), 10);
    if (Number.isFinite(todoId)) {
      if (opts.status === "afgerond" || opts.status === "genegeerd") {
        db.prepare(
          `UPDATE todos SET status = 'afgerond', updated_at = datetime('now') WHERE id = ? AND klant = ?`
        ).run(todoId, klant);
      } else if (opts.status === "in_behandeling") {
        db.prepare(
          `UPDATE todos SET status = 'in_behandeling', updated_at = datetime('now') WHERE id = ? AND klant = ?`
        ).run(todoId, klant);
      }
    }
  }

  const payload = buildCommandCenterTodos(klant);
  return (
    payload.open.find((t) => t.id === opts.item_key) ??
    payload.done.find((t) => t.id === opts.item_key) ??
    null
  );
}

export function formatCommandCenterDigest(
  payload: CommandCenterTodosPayload,
  baseUrl: string
): string {
  const lines = [`Te doen: ${payload.counts.open} openstaande acties`];
  const top = payload.open.slice(0, 3);
  if (top.length === 0) {
    lines.push("Geen openstaande acties — alles bij.");
  } else {
    top.forEach((t, i) => {
      lines.push(`${i + 1}. ${t.title}`);
    });
  }
  lines.push(`Open Command Center: ${baseUrl.replace(/\/$/, "")}/fumero`);
  return lines.join("\n");
}
