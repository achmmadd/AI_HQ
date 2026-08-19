/**
 * P2.1 synthetic outcome-review journal.
 *
 * Append-only JSONL on a P2-only volume. Not Kernel, not Postgres, not SQLite,
 * not the P0 store. Reconstruction is template-id + digest only — no free body.
 */

import { createHash, randomUUID } from "node:crypto";
import {
  appendFileSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";

import { FORBIDDEN_VIEW_MARKERS, HOME_TENANT_ID, type P1AttentionItem, type P1Draft } from "./p1-foundation.ts";
import type { ReviewPatch, ReviewStatus } from "./p1-review.ts";
import { NUC_ORCHESTRATOR_STABLE_ID, isStableNodeId } from "./p2-orchestrator.ts";

export const P2_JOURNAL_DIR_DEFAULT = "/p2-review";
export const P2_JOURNAL_FILE_NAME = "outcome-review.jsonl";

export const P2_JOURNAL_EVENT_TYPES = ["draft_created", "review_submitted", "review_decided"] as const;
export type P2JournalEventType = (typeof P2_JOURNAL_EVENT_TYPES)[number];

const REVIEW_STATUSES: readonly ReviewStatus[] = ["draft", "in_review", "approved", "rejected"];
const TERMINAL: ReadonlySet<ReviewStatus> = new Set(["approved", "rejected"]);

const EVENT_KEYS = [
  "event_id",
  "type",
  "workspace_id",
  "actor_stable_id",
  "draft_id",
  "from_status",
  "to_status",
  "synthetic_template_id",
  "draft_body_digest",
  "occurred_at",
] as const;

export type P2SyntheticTemplate = {
  readonly id: string;
  readonly projectId: "prj-review-keten" | "prj-observatie-keten";
  readonly title: string;
  readonly body: string;
  readonly digest: string;
};

function digestOf(text: string): string {
  return `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
}

const REVIEW_REPLY_BODY = "Vaste P2.1-template: intern reviewantwoord zonder bedrijfsfeiten.";
const OBSERVATION_BODY = "Vaste P2.1-template: observatie zonder adapter- of klantinhoud.";

export const P2_SYNTHETIC_TEMPLATES: Readonly<Record<string, P2SyntheticTemplate>> = Object.freeze({
  "tpl-p21-review-reply": Object.freeze({
    id: "tpl-p21-review-reply",
    projectId: "prj-review-keten",
    title: "Synthetisch reviewantwoord",
    body: REVIEW_REPLY_BODY,
    digest: digestOf(REVIEW_REPLY_BODY),
  }),
  "tpl-p21-observation-note": Object.freeze({
    id: "tpl-p21-observation-note",
    projectId: "prj-observatie-keten",
    title: "Synthetische observatienoot",
    body: OBSERVATION_BODY,
    digest: digestOf(OBSERVATION_BODY),
  }),
});

export type P2JournalEvent = {
  readonly event_id: string;
  readonly type: P2JournalEventType;
  readonly workspace_id: typeof HOME_TENANT_ID;
  readonly actor_stable_id: string;
  readonly draft_id: string;
  readonly from_status: ReviewStatus | null;
  readonly to_status: ReviewStatus;
  readonly synthetic_template_id: string;
  readonly draft_body_digest: string;
  readonly occurred_at: string;
};

export type JournalCommitResult =
  | { readonly ok: true; readonly outcome: "appended" | "duplicate_noop"; readonly event: P2JournalEvent }
  | { readonly ok: false; readonly reason: string };

export type JournalDraftRecord = {
  readonly draftId: string;
  readonly templateId: string;
  readonly projectId: string;
  readonly title: string;
  readonly digest: string;
  readonly actorStableId: string;
  readonly status: ReviewStatus;
  readonly reviewId: string;
  readonly lastEventType: P2JournalEventType;
  readonly occurredAt: string;
};

export type JournalProjection = {
  readonly drafts: readonly P1Draft[];
  readonly attention: readonly P1AttentionItem[];
  readonly patches: readonly ReviewPatch[];
  readonly records: ReadonlyMap<string, JournalDraftRecord>;
};

export type JournalOverviewItem = {
  readonly draft_id: string;
  readonly status: ReviewStatus;
  readonly type: P2JournalEventType;
  readonly synthetic_template_id: string;
  readonly digest: string;
  readonly occurred_at: string;
  readonly actor_stable_id: string;
};

export type JournalOverview = {
  readonly counts: {
    readonly open: number;
    readonly in_review: number;
    readonly done: number;
  };
  readonly items: readonly JournalOverviewItem[];
};

export const EMPTY_JOURNAL_OVERVIEW: JournalOverview = Object.freeze({
  counts: Object.freeze({ open: 0, in_review: 0, done: 0 }),
  items: Object.freeze([]),
});

/** Reconstruct the helper overview from journal events. Not a second inbox. */
export function summarizeJournal(projection: JournalProjection): JournalOverview {
  const items: JournalOverviewItem[] = [];
  let open = 0;
  let inReview = 0;
  let done = 0;
  for (const record of projection.records.values()) {
    if (!record.draftId.startsWith("draft-p21-")) continue;
    if (record.status === "draft") open += 1;
    else if (record.status === "in_review") inReview += 1;
    else done += 1;
    items.push(
      Object.freeze({
        draft_id: record.draftId,
        status: record.status,
        type: record.lastEventType,
        synthetic_template_id: record.templateId,
        digest: record.digest,
        occurred_at: record.occurredAt,
        actor_stable_id: record.actorStableId,
      }),
    );
  }
  return Object.freeze({
    counts: Object.freeze({ open, in_review: inReview, done }),
    items: Object.freeze(items),
  });
}

class Mutex {
  private chain: Promise<void> = Promise.resolve();

  run<T>(fn: () => Promise<T> | T): Promise<T> {
    const run = this.chain.then(fn, fn);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}

function isReviewStatus(value: unknown): value is ReviewStatus {
  return typeof value === "string" && (REVIEW_STATUSES as readonly string[]).includes(value);
}

export function resolveSyntheticTemplate(id: unknown): P2SyntheticTemplate | null {
  if (typeof id !== "string") return null;
  return P2_SYNTHETIC_TEMPLATES[id] ?? null;
}

export function newJournalEventId(): string {
  return randomUUID();
}

export function newJournalDraftId(templateId: string): string {
  return `draft-p21-${templateId}-${randomUUID().slice(0, 8)}`;
}

function eventBlobForbidden(event: P2JournalEvent): boolean {
  const blob = JSON.stringify(event);
  if (blob.includes(NUC_ORCHESTRATOR_STABLE_ID)) return true;
  if (blob.includes(FORBIDDEN_VIEW_MARKERS.secret) || blob.includes(FORBIDDEN_VIEW_MARKERS.contextBody)) {
    return true;
  }
  if (/\b\d{1,3}(?:\.\d{1,3}){3}\b/.test(blob)) return true;
  return false;
}

export function parseJournalEvent(raw: unknown): P2JournalEvent | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  for (const key of Object.keys(row)) {
    if (!(EVENT_KEYS as readonly string[]).includes(key)) return null;
  }
  if (typeof row.event_id !== "string" || row.event_id.length === 0) return null;
  if (!(P2_JOURNAL_EVENT_TYPES as readonly string[]).includes(String(row.type))) return null;
  if (row.workspace_id !== HOME_TENANT_ID) return null;
  if (typeof row.actor_stable_id !== "string" || !isStableNodeId(row.actor_stable_id)) return null;
  if (row.actor_stable_id === NUC_ORCHESTRATOR_STABLE_ID) return null;
  if (typeof row.draft_id !== "string" || !row.draft_id.startsWith("draft-p21-")) return null;
  if (row.from_status !== null && !isReviewStatus(row.from_status)) return null;
  if (!isReviewStatus(row.to_status)) return null;
  const template = resolveSyntheticTemplate(row.synthetic_template_id);
  if (!template) return null;
  if (row.draft_body_digest !== template.digest) return null;
  if (typeof row.occurred_at !== "string" || Number.isNaN(Date.parse(row.occurred_at))) return null;

  const event: P2JournalEvent = Object.freeze({
    event_id: row.event_id,
    type: row.type as P2JournalEventType,
    workspace_id: HOME_TENANT_ID,
    actor_stable_id: row.actor_stable_id,
    draft_id: row.draft_id,
    from_status: row.from_status,
    to_status: row.to_status,
    synthetic_template_id: template.id,
    draft_body_digest: template.digest,
    occurred_at: row.occurred_at,
  });
  if (eventBlobForbidden(event)) return null;
  return event;
}

function expectedTransition(type: P2JournalEventType, to: ReviewStatus): { from: ReviewStatus | null; to: ReviewStatus } | null {
  if (type === "draft_created" && to === "draft") return { from: null, to: "draft" };
  if (type === "review_submitted" && to === "in_review") return { from: "draft", to: "in_review" };
  if (type === "review_decided" && (to === "approved" || to === "rejected")) {
    return { from: "in_review", to };
  }
  return null;
}

function draftFromTemplate(draftId: string, template: P2SyntheticTemplate): P1Draft {
  return Object.freeze({
    id: draftId,
    tenantId: HOME_TENANT_ID,
    projectId: template.projectId,
    kind: "draft",
    state: "draft",
    origin: "typed",
    title: template.title,
    bodyDigest: template.digest,
  });
}

function attentionFor(draft: P1Draft): P1AttentionItem {
  return Object.freeze({
    id: `att-${draft.id}`,
    tenantId: HOME_TENANT_ID,
    projectId: draft.projectId,
    departmentId: draft.projectId === "prj-observatie-keten" ? "dep-koppelingen" : "dep-reviewkring",
    ownerId: "emp-mira",
    stage: "vraag",
    kind: "approval",
    title: draft.title ?? draft.id,
    summary: "Synthetisch P2.1-concept. Publiceren blijft DENY.",
    references: Object.freeze({
      taskId: null,
      runId: null,
      attemptId: null,
      approvalId: null,
      evidenceId: null,
    }),
  });
}

export function projectJournalEvents(events: readonly P2JournalEvent[]): JournalProjection {
  const seenIds = new Set<string>();
  const records = new Map<string, JournalDraftRecord>();
  const drafts: P1Draft[] = [];
  const attention: P1AttentionItem[] = [];
  const patches: ReviewPatch[] = [];

  for (const event of events) {
    if (seenIds.has(event.event_id)) continue;
    seenIds.add(event.event_id);
    const expected = expectedTransition(event.type, event.to_status);
    if (!expected) continue;
    if (event.from_status !== expected.from || event.to_status !== expected.to) continue;
    const template = resolveSyntheticTemplate(event.synthetic_template_id);
    if (!template) continue;

    if (event.type === "draft_created") {
      if (records.has(event.draft_id)) continue;
      const draft = draftFromTemplate(event.draft_id, template);
      records.set(event.draft_id, {
        draftId: event.draft_id,
        templateId: template.id,
        projectId: template.projectId,
        title: template.title,
        digest: template.digest,
        actorStableId: event.actor_stable_id,
        status: "draft",
        reviewId: `review-p21-${event.draft_id}`,
        lastEventType: event.type,
        occurredAt: event.occurred_at,
      });
      drafts.push(draft);
      attention.push(attentionFor(draft));
      continue;
    }

    const current = records.get(event.draft_id);
    if (!current || current.status !== expected.from) continue;
    if (TERMINAL.has(current.status)) continue;
    const next: JournalDraftRecord = {
      ...current,
      status: event.to_status,
      lastEventType: event.type,
      occurredAt: event.occurred_at,
    };
    records.set(event.draft_id, next);
    patches.push(
      Object.freeze({
        draftId: event.draft_id,
        tenantId: HOME_TENANT_ID,
        status: event.to_status as Extract<ReviewStatus, "in_review" | "approved" | "rejected">,
        reviewId: next.reviewId,
      }),
    );
  }

  return {
    drafts: Object.freeze(drafts),
    attention: Object.freeze(attention),
    patches: Object.freeze(patches),
    records,
  };
}

export class ReviewJournal {
  readonly dir: string;
  readonly file: string;
  private readonly mutex = new Mutex();
  private events: P2JournalEvent[] = [];
  private loaded = false;

  constructor(dir: string) {
    this.dir = dir;
    this.file = join(dir, P2_JOURNAL_FILE_NAME);
  }

  load(): JournalProjection {
    mkdirSync(this.dir, { recursive: true });
    if (!existsSync(this.file)) {
      this.events = [];
      this.loaded = true;
      return projectJournalEvents([]);
    }
    const lines = readFileSync(this.file, "utf8").split("\n");
    const events: P2JournalEvent[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
      if (!line.trim()) continue;
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }
      const event = parseJournalEvent(parsed);
      if (!event) continue;
      if (seen.has(event.event_id)) continue;
      seen.add(event.event_id);
      events.push(event);
    }
    this.events = events;
    this.loaded = true;
    return this.projection();
  }

  projection(): JournalProjection {
    if (!this.loaded) this.load();
    return projectJournalEvents(this.events);
  }

  commit(event: P2JournalEvent): Promise<JournalCommitResult> {
    return this.mutex.run(() => this.commitUnlocked(event));
  }

  private commitUnlocked(event: P2JournalEvent): JournalCommitResult {
    if (!this.loaded) this.load();
    const parsed = parseJournalEvent(event);
    if (!parsed) return { ok: false, reason: "invalid_event" };
    const existing = this.events.find((row) => row.event_id === parsed.event_id);
    if (existing) return { ok: true, outcome: "duplicate_noop", event: existing };

    const expected = expectedTransition(parsed.type, parsed.to_status);
    if (!expected) return { ok: false, reason: "invalid_transition" };
    if (parsed.from_status !== expected.from || parsed.to_status !== expected.to) {
      return { ok: false, reason: "invalid_transition" };
    }

    const projection = projectJournalEvents(this.events);
    const current = projection.records.get(parsed.draft_id);

    if (parsed.type === "draft_created") {
      if (current) return { ok: false, reason: "invalid_transition" };
    } else {
      if (!current) return { ok: false, reason: "not_found" };
      if (TERMINAL.has(current.status) || current.status !== expected.from) {
        return { ok: false, reason: "invalid_transition" };
      }
    }

    mkdirSync(this.dir, { recursive: true });
    const line = `${JSON.stringify(parsed)}\n`;
    const fd = openSync(this.file, "a");
    try {
      appendFileSync(fd, line);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    this.events.push(parsed);
    return { ok: true, outcome: "appended", event: parsed };
  }
}

export function buildDraftCreatedEvent(input: {
  readonly actorStableId: string;
  readonly templateId: string;
  readonly eventId?: string;
  readonly draftId?: string;
  readonly occurredAt?: string;
}): JournalCommitResult {
  const template = resolveSyntheticTemplate(input.templateId);
  if (!template) return { ok: false, reason: "unknown_template" };
  if (!isStableNodeId(input.actorStableId) || input.actorStableId === NUC_ORCHESTRATOR_STABLE_ID) {
    return { ok: false, reason: "actor_denied" };
  }
  const event: P2JournalEvent = {
    event_id: input.eventId ?? newJournalEventId(),
    type: "draft_created",
    workspace_id: HOME_TENANT_ID,
    actor_stable_id: input.actorStableId,
    draft_id: input.draftId ?? newJournalDraftId(template.id),
    from_status: null,
    to_status: "draft",
    synthetic_template_id: template.id,
    draft_body_digest: template.digest,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  };
  const parsed = parseJournalEvent(event);
  if (!parsed) return { ok: false, reason: "invalid_event" };
  return { ok: true, outcome: "appended", event: parsed };
}

export function buildTransitionEvent(input: {
  readonly type: Exclude<P2JournalEventType, "draft_created">;
  readonly actorStableId: string;
  readonly draftId: string;
  readonly templateId: string;
  readonly toStatus: ReviewStatus;
  readonly eventId?: string;
  readonly occurredAt?: string;
}): JournalCommitResult {
  const template = resolveSyntheticTemplate(input.templateId);
  if (!template) return { ok: false, reason: "unknown_template" };
  if (!isStableNodeId(input.actorStableId) || input.actorStableId === NUC_ORCHESTRATOR_STABLE_ID) {
    return { ok: false, reason: "actor_denied" };
  }
  const from = input.type === "review_submitted" ? "draft" : "in_review";
  const event: P2JournalEvent = {
    event_id: input.eventId ?? newJournalEventId(),
    type: input.type,
    workspace_id: HOME_TENANT_ID,
    actor_stable_id: input.actorStableId,
    draft_id: input.draftId,
    from_status: from,
    to_status: input.toStatus,
    synthetic_template_id: template.id,
    draft_body_digest: template.digest,
    occurred_at: input.occurredAt ?? new Date().toISOString(),
  };
  const parsed = parseJournalEvent(event);
  if (!parsed) return { ok: false, reason: "invalid_event" };
  return { ok: true, outcome: "appended", event: parsed };
}
