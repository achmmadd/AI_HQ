/**
 * P2.1 outcome-review journal.
 *
 * Append-only JSONL on a P2-only volume. Not Kernel, not Postgres, not SQLite,
 * not the P0 store. Two closed event shapes: synthetic template-id + digest, or
 * one pinned P0 reference (source_id + bounded title + digest). No free body.
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
import {
  P2_P0_SOURCE_KIND,
  isBoundedP0Title,
  resolvePinnedP0Reference,
  type PinnedP0Reference,
} from "./p2-p0-reference.ts";
import { NUC_ORCHESTRATOR_STABLE_ID, isStableNodeId } from "./p2-orchestrator.ts";

export const P2_JOURNAL_DIR_DEFAULT = "/p2-review";
export const P2_JOURNAL_FILE_NAME = "outcome-review.jsonl";

export const P2_JOURNAL_EVENT_TYPES = ["draft_created", "review_submitted", "review_decided"] as const;
export type P2JournalEventType = (typeof P2_JOURNAL_EVENT_TYPES)[number];

const REVIEW_STATUSES: readonly ReviewStatus[] = ["draft", "in_review", "approved", "rejected"];
const TERMINAL: ReadonlySet<ReviewStatus> = new Set(["approved", "rejected"]);

const SHARED_EVENT_KEYS = [
  "event_id",
  "type",
  "workspace_id",
  "actor_stable_id",
  "draft_id",
  "from_status",
  "to_status",
  "draft_body_digest",
  "occurred_at",
] as const;

const SYNTHETIC_EVENT_KEYS = [...SHARED_EVENT_KEYS, "synthetic_template_id"] as const;
const P0_EVENT_KEYS = [...SHARED_EVENT_KEYS, "source_kind", "source_id", "title"] as const;

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

type P2JournalEventBase = {
  readonly event_id: string;
  readonly type: P2JournalEventType;
  readonly workspace_id: typeof HOME_TENANT_ID;
  readonly actor_stable_id: string;
  readonly draft_id: string;
  readonly from_status: ReviewStatus | null;
  readonly to_status: ReviewStatus;
  readonly draft_body_digest: string;
  readonly occurred_at: string;
};

export type P2SyntheticJournalEvent = P2JournalEventBase & {
  readonly synthetic_template_id: string;
};

export type P2P0JournalEvent = P2JournalEventBase & {
  readonly source_kind: typeof P2_P0_SOURCE_KIND;
  readonly source_id: string;
  readonly title: string;
};

export type P2JournalEvent = P2SyntheticJournalEvent | P2P0JournalEvent;

export function isP0JournalEvent(event: P2JournalEvent): event is P2P0JournalEvent {
  return "source_kind" in event;
}

export type JournalCommitResult =
  | { readonly ok: true; readonly outcome: "appended" | "duplicate_noop"; readonly event: P2JournalEvent }
  | { readonly ok: false; readonly reason: string };

export type JournalDraftRecord = {
  readonly draftId: string;
  readonly templateId: string | null;
  readonly sourceId: string | null;
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
  readonly title: string;
  readonly status: ReviewStatus;
  readonly type: P2JournalEventType;
  readonly synthetic_template_id?: string;
  readonly source_kind?: typeof P2_P0_SOURCE_KIND;
  readonly source_id?: string;
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
        title: record.title,
        status: record.status,
        type: record.lastEventType,
        ...(record.sourceId
          ? { source_kind: P2_P0_SOURCE_KIND, source_id: record.sourceId }
          : { synthetic_template_id: record.templateId ?? undefined }),
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

function exactKeys(row: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(row);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
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

type SharedParsedFields = {
  readonly event_id: string;
  readonly type: P2JournalEventType;
  readonly actor_stable_id: string;
  readonly draft_id: string;
  readonly from_status: ReviewStatus | null;
  readonly to_status: ReviewStatus;
  readonly occurred_at: string;
};

function parseSharedFields(row: Record<string, unknown>): SharedParsedFields | null {
  if (typeof row.event_id !== "string" || row.event_id.length === 0) return null;
  if (!(P2_JOURNAL_EVENT_TYPES as readonly string[]).includes(String(row.type))) return null;
  if (row.workspace_id !== HOME_TENANT_ID) return null;
  if (typeof row.actor_stable_id !== "string" || !isStableNodeId(row.actor_stable_id)) return null;
  if (row.actor_stable_id === NUC_ORCHESTRATOR_STABLE_ID) return null;
  if (typeof row.draft_id !== "string" || !row.draft_id.startsWith("draft-p21-")) return null;
  if (row.from_status !== null && !isReviewStatus(row.from_status)) return null;
  if (!isReviewStatus(row.to_status)) return null;
  if (typeof row.occurred_at !== "string" || Number.isNaN(Date.parse(row.occurred_at))) return null;
  return {
    event_id: row.event_id,
    type: row.type as P2JournalEventType,
    actor_stable_id: row.actor_stable_id,
    draft_id: row.draft_id,
    from_status: row.from_status,
    to_status: row.to_status,
    occurred_at: row.occurred_at,
  };
}

function parseSyntheticJournalEvent(row: Record<string, unknown>): P2SyntheticJournalEvent | null {
  const shared = parseSharedFields(row);
  if (!shared) return null;
  const template = resolveSyntheticTemplate(row.synthetic_template_id);
  if (!template) return null;
  if (row.draft_body_digest !== template.digest) return null;
  const event: P2SyntheticJournalEvent = Object.freeze({
    ...shared,
    workspace_id: HOME_TENANT_ID,
    synthetic_template_id: template.id,
    draft_body_digest: template.digest,
  });
  if (eventBlobForbidden(event)) return null;
  return event;
}

function parseP0JournalEvent(row: Record<string, unknown>): P2P0JournalEvent | null {
  const shared = parseSharedFields(row);
  if (!shared) return null;
  if (row.source_kind !== P2_P0_SOURCE_KIND) return null;
  const pin = resolvePinnedP0Reference(row.source_id);
  if (!pin) return null;
  if (!isBoundedP0Title(row.title) || row.title !== pin.title) return null;
  if (row.draft_body_digest !== pin.digest) return null;
  const event: P2P0JournalEvent = Object.freeze({
    ...shared,
    workspace_id: HOME_TENANT_ID,
    source_kind: P2_P0_SOURCE_KIND,
    source_id: pin.source_id,
    title: row.title,
    draft_body_digest: pin.digest,
  });
  if (eventBlobForbidden(event)) return null;
  return event;
}

export function parseJournalEvent(raw: unknown): P2JournalEvent | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (exactKeys(row, SYNTHETIC_EVENT_KEYS)) return parseSyntheticJournalEvent(row);
  if (exactKeys(row, P0_EVENT_KEYS)) return parseP0JournalEvent(row);
  return null;
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

function draftFromP0(draftId: string, pin: PinnedP0Reference, title: string, digest: string): P1Draft {
  return Object.freeze({
    id: draftId,
    tenantId: HOME_TENANT_ID,
    projectId: pin.projectId,
    kind: "draft",
    state: "draft",
    origin: "typed",
    title,
    bodyDigest: digest,
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

    if (event.type === "draft_created") {
      if (records.has(event.draft_id)) continue;
      if (isP0JournalEvent(event)) {
        const pin = resolvePinnedP0Reference(event.source_id);
        if (!pin) continue;
        const draft = draftFromP0(event.draft_id, pin, event.title, event.draft_body_digest);
        records.set(event.draft_id, {
          draftId: event.draft_id,
          templateId: null,
          sourceId: event.source_id,
          projectId: pin.projectId,
          title: event.title,
          digest: event.draft_body_digest,
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
      const template = resolveSyntheticTemplate(event.synthetic_template_id);
      if (!template) continue;
      const draft = draftFromTemplate(event.draft_id, template);
      records.set(event.draft_id, {
        draftId: event.draft_id,
        templateId: template.id,
        sourceId: null,
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
  readonly templateId?: string;
  readonly sourceId?: string;
  readonly eventId?: string;
  readonly draftId?: string;
  readonly occurredAt?: string;
}): JournalCommitResult {
  if (!isStableNodeId(input.actorStableId) || input.actorStableId === NUC_ORCHESTRATOR_STABLE_ID) {
    return { ok: false, reason: "actor_denied" };
  }
  if (input.sourceId !== undefined && input.templateId !== undefined) {
    return { ok: false, reason: "invalid_event" };
  }
  if (input.sourceId !== undefined) {
    const pin = resolvePinnedP0Reference(input.sourceId);
    if (!pin) return { ok: false, reason: "unknown_source_id" };
    const event: P2P0JournalEvent = {
      event_id: input.eventId ?? newJournalEventId(),
      type: "draft_created",
      workspace_id: HOME_TENANT_ID,
      actor_stable_id: input.actorStableId,
      draft_id: input.draftId ?? newJournalDraftId("p0"),
      from_status: null,
      to_status: "draft",
      source_kind: P2_P0_SOURCE_KIND,
      source_id: pin.source_id,
      title: pin.title,
      draft_body_digest: pin.digest,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    };
    const parsed = parseJournalEvent(event);
    if (!parsed) return { ok: false, reason: "invalid_event" };
    return { ok: true, outcome: "appended", event: parsed };
  }
  const template = resolveSyntheticTemplate(input.templateId);
  if (!template) return { ok: false, reason: "unknown_template" };
  const event: P2SyntheticJournalEvent = {
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
  readonly toStatus: ReviewStatus;
  readonly templateId?: string;
  readonly sourceId?: string;
  readonly eventId?: string;
  readonly occurredAt?: string;
}): JournalCommitResult {
  if (!isStableNodeId(input.actorStableId) || input.actorStableId === NUC_ORCHESTRATOR_STABLE_ID) {
    return { ok: false, reason: "actor_denied" };
  }
  if (input.sourceId !== undefined && input.templateId !== undefined) {
    return { ok: false, reason: "invalid_event" };
  }
  const from = input.type === "review_submitted" ? "draft" : "in_review";
  if (input.sourceId !== undefined) {
    const pin = resolvePinnedP0Reference(input.sourceId);
    if (!pin) return { ok: false, reason: "unknown_source_id" };
    const event: P2P0JournalEvent = {
      event_id: input.eventId ?? newJournalEventId(),
      type: input.type,
      workspace_id: HOME_TENANT_ID,
      actor_stable_id: input.actorStableId,
      draft_id: input.draftId,
      from_status: from,
      to_status: input.toStatus,
      source_kind: P2_P0_SOURCE_KIND,
      source_id: pin.source_id,
      title: pin.title,
      draft_body_digest: pin.digest,
      occurred_at: input.occurredAt ?? new Date().toISOString(),
    };
    const parsed = parseJournalEvent(event);
    if (!parsed) return { ok: false, reason: "invalid_event" };
    return { ok: true, outcome: "appended", event: parsed };
  }
  const template = resolveSyntheticTemplate(input.templateId);
  if (!template) return { ok: false, reason: "unknown_template" };
  const event: P2SyntheticJournalEvent = {
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
