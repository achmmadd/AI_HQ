/**
 * Postgres feature flags — ADR-002 milestones M1–M6.
 * SQLite remains primary until M4 (POSTGRES_PRIMARY=1).
 */

function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") return defaultValue;
  return raw === "1" || raw === "true" || raw === "yes";
}

/** M2+: write to Postgres in addition to SQLite. */
export function shouldDualWrite(): boolean {
  return envFlag("USE_POSTGRES", false);
}

/** M4+: Postgres is read/write SSOT; SQLite read-only backup. */
export function isPostgresPrimary(): boolean {
  return envFlag("POSTGRES_PRIMARY", false);
}

/** Any Postgres path enabled (dual-write or primary). */
export function shouldUsePostgres(): boolean {
  return shouldDualWrite() || isPostgresPrimary();
}

/** M6+: prod without SQLite fallback (SQLITE_FALLBACK=0). */
export function sqliteFallbackDisabled(): boolean {
  const raw = process.env.SQLITE_FALLBACK?.trim().toLowerCase();
  if (raw === undefined || raw === "") return false;
  return raw === "0" || raw === "false" || raw === "no";
}

export function getDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim();
  return url || undefined;
}
