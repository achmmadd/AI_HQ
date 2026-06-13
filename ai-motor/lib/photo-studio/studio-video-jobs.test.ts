import assert from "node:assert/strict";
import test from "node:test";
import {
  ensureStudioVideoJobsSchema,
  insertStudioVideoJob,
  getStudioVideoJob,
  markStudioVideoJobDone,
  __resetStudioVideoJobsSchemaCache,
} from "./studio-video-jobs";

test("studio video job lifecycle", () => {
  const db = {
    exec: (sql: string) => {
      db._sql.push(sql);
    },
    prepare: (sql: string) => ({
      run: (...args: unknown[]) => {
        db._runs.push({ sql, args });
        if (sql.includes("INSERT INTO photo_studio_video_jobs")) {
          db._row = {
            id: 1,
            job_id: args[0],
            klant: args[1],
            status: "pending",
            phase: null,
            progress_message: null,
            request_json: args[2],
            result_json: null,
            error: null,
            created_at: "now",
            updated_at: "now",
            started_at: null,
            finished_at: null,
          };
        }
        if (sql.includes("SET status = 'done'")) {
          db._row = { ...db._row, status: "done", result_json: args[0] };
        }
      },
      get: (...args: unknown[]) => {
        if (String(args[0]) === db._row?.job_id && String(args[1]) === db._row?.klant) {
          return db._row;
        }
        return undefined;
      },
    }),
    _sql: [] as string[],
    _runs: [] as Array<{ sql: string; args: unknown[] }>,
    _row: null as Record<string, unknown> | null,
  };

  __resetStudioVideoJobsSchemaCache();
  ensureStudioVideoJobsSchema(db as never);
  insertStudioVideoJob(db as never, {
    jobId: "svj_test",
    klant: "fumero",
    request: { user_prompt: "test" },
  });
  const row = getStudioVideoJob(db as never, "svj_test", "fumero");
  assert.equal(row?.status, "pending");
  markStudioVideoJobDone(db as never, "svj_test", { ok: true });
  const done = getStudioVideoJob(db as never, "svj_test", "fumero");
  assert.equal(done?.status, "done");
});
