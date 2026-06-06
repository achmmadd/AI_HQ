import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getDatabaseUrl, shouldUsePostgres } from "@/lib/db/pg-flags";
import * as schema from "./schema";

export type DrizzleDb = PostgresJsDatabase<typeof schema>;

let sqlClient: ReturnType<typeof postgres> | null = null;
let drizzleDb: DrizzleDb | null = null;

let adminSqlClient: ReturnType<typeof postgres> | null = null;
let adminDrizzleDb: DrizzleDb | null = null;

function createPostgresClient(url: string) {
  return postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
}

/** Lazy Postgres client — no connection unless USE_POSTGRES or POSTGRES_PRIMARY is set. */
export function getDrizzleDb(): DrizzleDb | null {
  if (!shouldUsePostgres()) return null;

  const url = getDatabaseUrl();
  if (!url) {
    console.warn("[drizzle] DATABASE_URL missing — Postgres disabled");
    return null;
  }

  if (!drizzleDb) {
    sqlClient = createPostgresClient(url);
    drizzleDb = drizzle(sqlClient, { schema });
  }

  return drizzleDb;
}

/** Admin PG client when DATABASE_URL is set (workspace lookup, login enrichment). */
export function getDrizzleDbAdmin(): DrizzleDb | null {
  const url = getDatabaseUrl();
  if (!url) return null;

  if (!adminDrizzleDb) {
    adminSqlClient = createPostgresClient(url);
    adminDrizzleDb = drizzle(adminSqlClient, { schema });
  }

  return adminDrizzleDb;
}

export async function closePgConnection(): Promise<void> {
  if (sqlClient) {
    await sqlClient.end({ timeout: 5 });
    sqlClient = null;
    drizzleDb = null;
  }
  if (adminSqlClient) {
    await adminSqlClient.end({ timeout: 5 });
    adminSqlClient = null;
    adminDrizzleDb = null;
  }
}
