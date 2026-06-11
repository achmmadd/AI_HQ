import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import {
  ensureAppGenerationJobsSchema,
  getGenerationJob,
  insertGenerationJob,
  markGenerationJobDone,
  markGenerationJobError,
  markGenerationJobRunning,
  reapStaleGenerationJobs,
  touchGenerationJob,
  updateGenerationJobProgress,
  __resetGenerationJobsSchemaCache,
} from "@/lib/apps/app-generation-jobs";

function freshDb() {
  __resetGenerationJobsSchemaCache();
  const db = new Database(":memory:");
  ensureAppGenerationJobsSchema(db);
  return db;
}

test("job lifecycle: pending -> running -> done", () => {
  const db = freshDb();
  const job = insertGenerationJob(db, {
    jobId: "j1",
    klant: "fumero",
    action: "create",
    prompt: "bouw een webshop",
  });
  assert.equal(job.status, "pending");
  assert.equal(job.action, "create");

  markGenerationJobRunning(db, "j1");
  assert.equal(getGenerationJob(db, "j1", "fumero")!.status, "running");

  markGenerationJobDone(db, "j1", {
    slug: "webshop-abc",
    result: { ok: true, slug: "webshop-abc", naam: "Webshop", tables: 3 },
  });
  const done = getGenerationJob(db, "j1", "fumero")!;
  assert.equal(done.status, "done");
  assert.equal(done.slug, "webshop-abc");
  assert.ok(done.finished_at);
  const parsed = JSON.parse(done.result_json!);
  assert.equal(parsed.naam, "Webshop");
  db.close();
});

test("job lifecycle: pending -> running -> error", () => {
  const db = freshDb();
  insertGenerationJob(db, {
    jobId: "j2",
    klant: "fumero",
    action: "create",
    prompt: "x",
  });
  markGenerationJobRunning(db, "j2");
  markGenerationJobError(db, "j2", "builder mislukt");
  const row = getGenerationJob(db, "j2", "fumero")!;
  assert.equal(row.status, "error");
  assert.match(row.error!, /builder mislukt/);
  db.close();
});

test("done is terminal: error after done does not overwrite", () => {
  const db = freshDb();
  insertGenerationJob(db, {
    jobId: "j3",
    klant: "fumero",
    action: "create",
    prompt: "x",
  });
  markGenerationJobDone(db, "j3", { slug: "s", result: { ok: true, slug: "s" } });
  markGenerationJobError(db, "j3", "te laat");
  assert.equal(getGenerationJob(db, "j3", "fumero")!.status, "done");
  db.close();
});

test("getGenerationJob is klant-scoped", () => {
  const db = freshDb();
  insertGenerationJob(db, {
    jobId: "j4",
    klant: "fumero",
    action: "create",
    prompt: "x",
  });
  assert.ok(getGenerationJob(db, "j4", "fumero"));
  assert.equal(getGenerationJob(db, "j4", "andere-klant"), undefined);
  db.close();
});

test("refine job stores target slug", () => {
  const db = freshDb();
  const job = insertGenerationJob(db, {
    jobId: "j5",
    klant: "fumero",
    action: "refine",
    prompt: "voeg filter toe",
    slug: "bestaande-app",
  });
  assert.equal(job.action, "refine");
  assert.equal(job.slug, "bestaande-app");
  db.close();
});

test("reapStaleGenerationJobs marks stale running jobs as error", () => {
  const db = freshDb();
  insertGenerationJob(db, {
    jobId: "stale",
    klant: "fumero",
    action: "create",
    prompt: "x",
  });
  markGenerationJobRunning(db, "stale");
  // Forceer een oude updated_at (10 minuten geleden).
  db.prepare(
    `UPDATE app_generation_jobs SET updated_at = datetime('now', '-600 seconds') WHERE job_id = 'stale'`
  ).run();

  const reaped = reapStaleGenerationJobs(db, 240_000);
  assert.equal(reaped, 1);
  const row = getGenerationJob(db, "stale", "fumero")!;
  assert.equal(row.status, "error");
  assert.match(row.error!, /vastgelopen|herstart/i);
  db.close();
});

test("reapStaleGenerationJobs leaves fresh running jobs untouched", () => {
  const db = freshDb();
  insertGenerationJob(db, {
    jobId: "fresh",
    klant: "fumero",
    action: "create",
    prompt: "x",
  });
  markGenerationJobRunning(db, "fresh");
  touchGenerationJob(db, "fresh");

  const reaped = reapStaleGenerationJobs(db, 240_000);
  assert.equal(reaped, 0);
  assert.equal(getGenerationJob(db, "fresh", "fumero")!.status, "running");
  db.close();
});

test("touchGenerationJob only affects running jobs", () => {
  const db = freshDb();
  insertGenerationJob(db, {
    jobId: "j6",
    klant: "fumero",
    action: "create",
    prompt: "x",
  });
  // pending: touch is een no-op (geen running)
  touchGenerationJob(db, "j6");
  assert.equal(getGenerationJob(db, "j6", "fumero")!.status, "pending");
  db.close();
});

test("progress update stores phase message and plan while running", () => {
  const db = freshDb();
  insertGenerationJob(db, {
    jobId: "j7",
    klant: "fumero",
    action: "create",
    prompt: "bouw projectportaal",
  });
  markGenerationJobRunning(db, "j7");
  updateGenerationJobProgress(db, "j7", {
    phase: "planning",
    message: "Plan klaar",
    plan: { version: 2, appType: "portal" },
  });
  const row = getGenerationJob(db, "j7", "fumero")!;
  assert.equal(row.phase, "planning");
  assert.equal(row.progress_message, "Plan klaar");
  assert.deepEqual(JSON.parse(row.plan_json!), { version: 2, appType: "portal" });
  db.close();
});
