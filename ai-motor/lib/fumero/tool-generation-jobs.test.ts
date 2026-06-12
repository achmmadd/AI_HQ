import assert from "node:assert/strict";
import test from "node:test";
import Database from "better-sqlite3";
import {
  __resetToolGenerationJobsSchemaCache,
  ensureToolGenerationJobsSchema,
  getToolGenerationJob,
  insertToolGenerationJob,
  markToolGenerationJobDone,
  markToolGenerationJobRunning,
  reapStaleToolGenerationJobs,
} from "./tool-generation-jobs";

function memoryDb() {
  __resetToolGenerationJobsSchemaCache();
  const db = new Database(":memory:");
  ensureToolGenerationJobsSchema(db);
  return db;
}

test("tool generation job lifecycle", () => {
  const db = memoryDb();
  insertToolGenerationJob(db, {
    jobId: "tjob_test",
    klant: "fumero",
    action: "create",
    prompt: "calculator",
    payload: { name: "Calc", deploy_type: "widget" },
  });
  markToolGenerationJobRunning(db, "tjob_test");
  markToolGenerationJobDone(db, "tjob_test", { tool_id: 1 });
  const row = getToolGenerationJob(db, "tjob_test", "fumero");
  assert.equal(row?.status, "done");
});

test("reapStaleToolGenerationJobs marks stuck jobs error", () => {
  const db = memoryDb();
  insertToolGenerationJob(db, {
    jobId: "tjob_stale",
    klant: "fumero",
    action: "create",
    prompt: "x",
  });
  db.prepare(
    `UPDATE fumero_tool_generation_jobs SET status = 'running', updated_at = datetime('now', '-2 hours') WHERE job_id = ?`
  ).run("tjob_stale");
  const n = reapStaleToolGenerationJobs(db, 60_000);
  assert.equal(n, 1);
  const row = getToolGenerationJob(db, "tjob_stale", "fumero");
  assert.equal(row?.status, "error");
});
