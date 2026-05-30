import db from "@/lib/db/database";
import { ensurePlatformSchema } from "@/lib/db/platform-schema";

export type DeployHistoryRow = {
  id: number;
  klant: string | null;
  source: string;
  slug: string | null;
  repo_url: string | null;
  live_url: string | null;
  environment: string;
  status: string;
  deployment_id: string | null;
  created_at: string;
};

export type InsertDeployHistory = {
  klant?: string | null;
  source: string;
  slug?: string | null;
  repo_url?: string | null;
  live_url?: string | null;
  environment?: string;
  status?: string;
  deployment_id?: string | null;
};

export function insertDeployHistory(row: InsertDeployHistory): DeployHistoryRow {
  ensurePlatformSchema();
  const result = db
    .prepare(
      `INSERT INTO deploy_history
       (klant, source, slug, repo_url, live_url, environment, status, deployment_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      row.klant ?? null,
      row.source,
      row.slug ?? null,
      row.repo_url ?? null,
      row.live_url ?? null,
      row.environment ?? "production",
      row.status ?? "success",
      row.deployment_id ?? null
    );
  return getDeployHistory(Number(result.lastInsertRowid))!;
}

export function getDeployHistory(id: number): DeployHistoryRow | null {
  ensurePlatformSchema();
  return (
    (db.prepare(`SELECT * FROM deploy_history WHERE id = ?`).get(id) as
      | DeployHistoryRow
      | undefined) ?? null
  );
}

export function listDeployHistory(opts?: {
  klant?: string | null;
  slug?: string | null;
  limit?: number;
}): DeployHistoryRow[] {
  ensurePlatformSchema();
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
  const clauses: string[] = [];
  const params: unknown[] = [];

  if (opts?.klant) {
    clauses.push("klant = ?");
    params.push(opts.klant);
  }
  if (opts?.slug) {
    clauses.push("slug = ?");
    params.push(opts.slug);
  }

  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  params.push(limit);

  return db
    .prepare(
      `SELECT * FROM deploy_history ${where}
       ORDER BY datetime(created_at) DESC LIMIT ?`
    )
    .all(...params) as DeployHistoryRow[];
}

export function getLatestDeployForSlug(
  slug: string,
  klant?: string | null
): DeployHistoryRow | null {
  ensurePlatformSchema();
  if (klant) {
    return (
      (db
        .prepare(
          `SELECT * FROM deploy_history
           WHERE slug = ? AND klant = ? AND status = 'success'
           ORDER BY datetime(created_at) DESC LIMIT 1`
        )
        .get(slug, klant) as DeployHistoryRow | undefined) ?? null
    );
  }
  return (
    (db
      .prepare(
        `SELECT * FROM deploy_history
         WHERE slug = ? AND status = 'success'
         ORDER BY datetime(created_at) DESC LIMIT 1`
      )
      .get(slug) as DeployHistoryRow | undefined) ?? null
  );
}

export function updateDeployHistoryStatus(
  id: number,
  status: string,
  deployment_id?: string | null
): DeployHistoryRow | null {
  ensurePlatformSchema();
  db.prepare(
    `UPDATE deploy_history SET status = ?, deployment_id = COALESCE(?, deployment_id)
     WHERE id = ?`
  ).run(status, deployment_id ?? null, id);
  return getDeployHistory(id);
}
