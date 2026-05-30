import crypto from "crypto";
import db from "@/lib/db/database";

const DEFAULT_TTL_HOURS = 24;

export type CachedResearchRow = {
  search_results: string;
  vision_analysis: string;
  patterns: string;
  analysis: string;
};

export function hashResearchKey(request: string, includeLinks: string[]): string {
  const sorted = [...includeLinks].map((s) => s.trim()).filter(Boolean).sort();
  const raw = `${request.trim()}\n${sorted.join("\n")}`;
  return crypto.createHash("sha256").update(raw, "utf8").digest("hex");
}

export function getResearchFromCache(
  queryHash: string
): CachedResearchRow | null {
  const row = db
    .prepare(
      `SELECT search_results, vision_analysis, patterns, analysis
       FROM builder_research_cache
       WHERE query_hash = ? AND datetime(expires_at) > datetime('now')`
    )
    .get(queryHash) as CachedResearchRow | undefined;
  return row ?? null;
}

export function setResearchCache(
  queryHash: string,
  payload: CachedResearchRow,
  ttlHours = DEFAULT_TTL_HOURS
): void {
  const expires = new Date(Date.now() + ttlHours * 3600_000).toISOString();
  db.prepare(
    `INSERT INTO builder_research_cache (query_hash, search_results, vision_analysis, patterns, analysis, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(query_hash) DO UPDATE SET
       search_results = excluded.search_results,
       vision_analysis = excluded.vision_analysis,
       patterns = excluded.patterns,
       analysis = excluded.analysis,
       cached_at = datetime('now'),
       expires_at = excluded.expires_at`
  ).run(
    queryHash,
    payload.search_results,
    payload.vision_analysis,
    payload.patterns,
    payload.analysis,
    expires
  );
}
