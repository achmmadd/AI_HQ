import assert from "node:assert/strict";
import Database from "better-sqlite3";
import test from "node:test";
import {
  __resetCampaignJobsSchemaCache,
  ensureCampaignJobsSchema,
  getCampaignJob,
  insertCampaignJob,
  markCampaignJobDone,
  markCampaignJobRunning,
  reapStaleCampaignJobs,
  updateCampaignJobProgress,
} from "@/lib/photo-studio/campaign/campaign-generation-jobs";

test("campaign job lifecycle", () => {
  __resetCampaignJobsSchemaCache();
  const db = new Database(":memory:");
  ensureCampaignJobsSchema(db);

  insertCampaignJob(db, {
    jobId: "cj_test_1",
    klant: "fumero",
    packId: "cp_test_1",
    request: { brand_kit_id: "bk1", goal: "verkoop", skip_media: true },
  });

  let row = getCampaignJob(db, "cj_test_1", "fumero");
  assert.equal(row?.status, "pending");

  markCampaignJobRunning(db, "cj_test_1");
  updateCampaignJobProgress(db, "cj_test_1", {
    phase: "static",
    message: "Static 1/3...",
  });

  row = getCampaignJob(db, "cj_test_1", "fumero");
  assert.equal(row?.status, "running");
  assert.equal(row?.phase, "static");

  markCampaignJobDone(db, "cj_test_1", {
    packId: "cp_test_1",
    result: { ok: true, pack_id: "cp_test_1" },
  });

  row = getCampaignJob(db, "cj_test_1", "fumero");
  assert.equal(row?.status, "done");
  assert.ok(row?.result_json?.includes("cp_test_1"));

  db.close();
});

test("reapStaleCampaignJobs marks old running jobs as error", () => {
  __resetCampaignJobsSchemaCache();
  const db = new Database(":memory:");
  ensureCampaignJobsSchema(db);

  insertCampaignJob(db, {
    jobId: "cj_stale",
    klant: "fumero",
    packId: "cp_stale",
    request: {},
  });
  markCampaignJobRunning(db, "cj_stale");
  db.prepare(
    `UPDATE fumero_campaign_jobs SET updated_at = datetime('now', '-600 seconds') WHERE job_id = 'cj_stale'`
  ).run();

  const reaped = reapStaleCampaignJobs(db, 60_000);
  assert.equal(reaped, 1);

  const row = getCampaignJob(db, "cj_stale", "fumero");
  assert.equal(row?.status, "error");

  db.close();
});
