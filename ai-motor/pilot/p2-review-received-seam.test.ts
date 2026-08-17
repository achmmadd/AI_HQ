/**
 * Local ReviewReceived seam — in-process draft intake only.
 * No HTTP listener, webhook, queue or second store.
 */

import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { HOME_TENANT_ID } from "./p1-foundation.ts";
import { NUC_ORCHESTRATOR_STABLE_ID } from "./p2-orchestrator.ts";
import { receiveSyntheticReview } from "./p2-review-received-seam.ts";
import { ReviewJournal } from "./p2-review-journal.ts";

const LAPTOP = "nP2LAPTOP";
const TEMPLATES = ["tpl-p21-review-reply", "tpl-p21-observation-note"] as const;

function tempJournalDir(): string {
  return mkdtempSync(join(tmpdir(), "p21-received-"));
}

function journalOf() {
  const dir = tempJournalDir();
  const journal = new ReviewJournal(dir);
  journal.load();
  return { dir, journal };
}

function laptopActor(workspaceId = HOME_TENANT_ID) {
  return { workspaceId, stableId: LAPTOP };
}

async function receive(
  intake: Record<string, unknown>,
  overrides: {
    readonly workspaceId?: string;
    readonly stableId?: string;
    readonly contextEnv?: Record<string, string | undefined>;
    readonly journal?: ReviewJournal;
  } = {},
) {
  const { journal } = overrides.journal ? { journal: overrides.journal } : journalOf();
  const result = await receiveSyntheticReview(intake, {
    verifiedActor: {
      workspaceId: overrides.workspaceId ?? HOME_TENANT_ID,
      stableId: overrides.stableId ?? LAPTOP,
    },
    journal,
    contextEnv: overrides.contextEnv ?? {},
  });
  return { result, journal };
}

function assertNoWrite(journal: ReviewJournal) {
  assert.equal(journal.projection().drafts.length, 0);
  assert.equal(journal.projection().records.size, 0);
  if (existsSync(journal.file)) {
    assert.equal(readFileSync(journal.file, "utf8").trim(), "");
  }
}

test("allowlisted templates via verified laptop actor each create one journal draft", async () => {
  for (const templateId of TEMPLATES) {
    const { journal } = journalOf();
    const result = await receiveSyntheticReview(
      { synthetic_template_id: templateId },
      { verifiedActor: laptopActor(), journal, contextEnv: {} },
    );
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.event.type, "draft_created");
    assert.equal(result.event.actor_stable_id, LAPTOP);
    assert.equal(result.event.workspace_id, HOME_TENANT_ID);
    assert.equal(result.event.synthetic_template_id, templateId);
    assert.equal(result.event.to_status, "draft");
    assert.equal(JSON.stringify(result.event).includes("ReviewReceived"), false);
    assert.equal(journal.projection().drafts.length, 1);
    assert.equal(journal.projection().records.get(result.event.draft_id)?.templateId, templateId);
  }
});

test("unknown template is DENY with no journal write", async () => {
  const { result, journal } = await receive({ synthetic_template_id: "tpl-unknown" });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "unknown_template");
  assertNoWrite(journal);
});

test("extra intake key is DENY with no journal write", async () => {
  const { result, journal } = await receive({
    synthetic_template_id: "tpl-p21-review-reply",
    source: "webhook",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "free_intake_not_allowed");
  assertNoWrite(journal);
});

test("NUC actor is DENY with no journal write", async () => {
  const { result, journal } = await receive(
    { synthetic_template_id: "tpl-p21-review-reply" },
    { stableId: NUC_ORCHESTRATOR_STABLE_ID },
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "actor_denied");
  assertNoWrite(journal);
});

test("wrong workspace is DENY with no journal write", async () => {
  const { result, journal } = await receive(
    { synthetic_template_id: "tpl-p21-review-reply" },
    { workspaceId: "ws-anders" },
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.reason, "unknown_workspace");
  assertNoWrite(journal);
});

test("private / context-volume / model / Qdrant env is DENY with no write", async () => {
  const cases: ReadonlyArray<{ env: Record<string, string | undefined>; reason: string }> = [
    { env: { CONTEXT_MODE: "private" }, reason: "private_declared_absent" },
    { env: { PILOT_P2_CONTEXT_VOLUME: "/tmp/p21-context-volume" }, reason: "private_blocked" },
    { env: { MODEL_PORT_URL: "http://127.0.0.1:8080" }, reason: "private_blocked" },
    { env: { QDRANT_URL: "http://127.0.0.1:6333" }, reason: "private_blocked" },
  ];
  for (const row of cases) {
    const { result, journal } = await receive(
      { synthetic_template_id: "tpl-p21-review-reply" },
      { contextEnv: row.env },
    );
    assert.equal(result.ok, false, JSON.stringify(row.env));
    if (result.ok) return;
    assert.equal(result.reason, row.reason);
    assertNoWrite(journal);
  }
});

test("production seam and server never hardcode the laptop StableID", () => {
  const seam = readFileSync(join(import.meta.dirname, "p2-review-received-seam.ts"), "utf8");
  const server = readFileSync(join(import.meta.dirname, "p2-motor-server.ts"), "utf8");
  assert.doesNotMatch(seam, /n42QGiXouB21CNTRL/);
  assert.doesNotMatch(server, /n42QGiXouB21CNTRL/);
});

test("seam has no outbound calls, HTTP listener, webhook, queue or second store", () => {
  const seam = readFileSync(join(import.meta.dirname, "p2-review-received-seam.ts"), "utf8");
  assert.doesNotMatch(seam, /from ["']node:http["']/);
  assert.doesNotMatch(seam, /createServer|httpGet|net\.|fetch\(/);
  assert.doesNotMatch(seam, /better-sqlite3|postgres:\/\/|POSTGRES_|drizzle/i);
  assert.doesNotMatch(seam, /"type":\s*"ReviewReceived"|ReviewReceived:/);
});
