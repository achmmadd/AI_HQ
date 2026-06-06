#!/usr/bin/env node
/**
 * Migrate SQLite tenant data → Postgres (Sprint 1.2 / ADR-002 M3).
 *
 * Tables: auth_users, chat_history, approvals, knowledge_documents
 *
 * Usage:
 *   node scripts/migrate-sqlite-to-postgres.mjs --dry-run
 *   node scripts/migrate-sqlite-to-postgres.mjs
 *   node scripts/migrate-sqlite-to-postgres.mjs --only auth,chat
 *
 * Env:
 *   DATABASE_URL     Postgres connection (required unless --dry-run)
 *   HOME             SQLite path: $HOME/AI_HQ/data/ai-motor.db (same as lib/db/database.ts)
 *
 * --dry-run: count rows and print plan; no Postgres writes.
 * --only:    comma-separated subset: auth, chat, approvals, knowledge
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const onlyArgIdx = args.indexOf("--only");
const onlyFilter =
  onlyArgIdx >= 0 && args[onlyArgIdx + 1]
    ? new Set(
        args[onlyArgIdx + 1]
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
      )
    : null;

const home = process.env.HOME || "/home/pietje";
const SQLITE_PATH = path.join(home, "AI_HQ", "data", "ai-motor.db");
const DATABASE_URL = process.env.DATABASE_URL?.trim();

function shouldRun(section) {
  if (!onlyFilter || onlyFilter.size === 0) return true;
  return onlyFilter.has(section);
}

function mapAuthRoleToMembershipRole(role) {
  return role === "admin" ? "admin" : "editor";
}

function workspaceSlugForKlant(klant) {
  const k = (klant || "").trim().toLowerCase();
  if (k === "fumero" || k === "bokas" || k === "personal") return k;
  if (k === "system" || k === "algemeen" || !k) return "motor";
  return "motor";
}

function parseSqliteDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function main() {
  console.log("=== SQLite → Postgres migration (Sprint 1.2) ===");
  console.log(`SQLite: ${SQLITE_PATH}`);
  console.log(`Mode:   ${dryRun ? "DRY RUN" : "LIVE"}`);

  if (!fs.existsSync(SQLITE_PATH)) {
    console.error(`SQLite database not found: ${SQLITE_PATH}`);
    process.exit(1);
  }

  if (!dryRun && !DATABASE_URL) {
    console.error("DATABASE_URL is required for live migration");
    process.exit(1);
  }

  const sqlite = new Database(SQLITE_PATH, { readonly: true });

  const counts = {
    auth_users: sqlite.prepare("SELECT COUNT(*) AS c FROM auth_users").get()?.c ?? 0,
    chat_history: sqlite
      .prepare("SELECT COUNT(*) AS c FROM chat_history")
      .get()?.c ?? 0,
    approvals: sqlite.prepare("SELECT COUNT(*) AS c FROM approvals").get()?.c ?? 0,
    knowledge_documents: tableExists(sqlite, "knowledge_documents")
      ? sqlite.prepare("SELECT COUNT(*) AS c FROM knowledge_documents").get()?.c ?? 0
      : 0,
  };

  console.log("\nSource row counts:");
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table}: ${count}`);
  }

  if (dryRun) {
    console.log("\nDry run complete — no writes performed.");
    console.log("Run without --dry-run after npm run db:migrate on Postgres.");
    sqlite.close();
    return;
  }

  const sql = postgres(DATABASE_URL, { max: 3, prepare: false });

  try {
    await sql`SELECT set_config('app.bypass_rls', '1', false)`;

    const workspaceRows = await sql`
      SELECT id, slug, legacy_klant FROM workspaces
    `;
    const bySlug = new Map(workspaceRows.map((r) => [r.slug, r.id]));
    const byLegacy = new Map(
      workspaceRows
        .filter((r) => r.legacy_klant)
        .map((r) => [r.legacy_klant, r.id])
    );

    function resolveWorkspaceId(klant) {
      const slug = workspaceSlugForKlant(klant);
      return bySlug.get(slug) ?? byLegacy.get(klant) ?? bySlug.get("motor");
    }

    const stats = {
      auth_users: { inserted: 0, updated: 0, memberships: 0 },
      chat_history: { inserted: 0, skipped: 0 },
      approvals: { inserted: 0, skipped: 0 },
      knowledge_documents: { inserted: 0, skipped: 0 },
    };

    if (shouldRun("auth")) {
      console.log("\nMigrating auth_users → users + workspace_memberships…");
      const users = sqlite
        .prepare(
          `SELECT id, email, password_hash, role, scope, active FROM auth_users`
        )
        .all();

      for (const row of users) {
        const email = row.email.trim().toLowerCase();
        const slug = workspaceSlugForKlant(
          row.scope === "all"
            ? "system"
            : row.scope === "personal"
              ? "personal"
              : row.scope
        );
        const workspaceId = bySlug.get(slug);
        if (!workspaceId) {
          console.warn(`  skip user ${email}: workspace slug ${slug} not found`);
          continue;
        }

        const existing = await sql`
          SELECT id FROM users WHERE email = ${email} LIMIT 1
        `;

        let userId;
        if (existing.length > 0) {
          userId = existing[0].id;
          await sql`
            UPDATE users SET
              password_hash = ${row.password_hash},
              active = ${row.active === 1},
              legacy_sqlite_id = ${String(row.id)},
              updated_at = now()
            WHERE id = ${userId}
          `;
          stats.auth_users.updated++;
        } else {
          const inserted = await sql`
            INSERT INTO users (email, password_hash, active, legacy_sqlite_id)
            VALUES (${email}, ${row.password_hash}, ${row.active === 1}, ${String(row.id)})
            RETURNING id
          `;
          userId = inserted[0].id;
          stats.auth_users.inserted++;
        }

        const membershipRole = mapAuthRoleToMembershipRole(row.role);
        const membership = await sql`
          SELECT id FROM workspace_memberships
          WHERE workspace_id = ${workspaceId} AND user_id = ${userId}
          LIMIT 1
        `;

        if (membership.length > 0) {
          await sql`
            UPDATE workspace_memberships SET
              role = ${membershipRole},
              scope = ${row.scope},
              updated_at = now()
            WHERE id = ${membership[0].id}
          `;
        } else {
          await sql`
            INSERT INTO workspace_memberships (workspace_id, user_id, role, scope)
            VALUES (${workspaceId}, ${userId}, ${membershipRole}, ${row.scope})
          `;
          stats.auth_users.memberships++;
        }
      }
      console.log(`  users: +${stats.auth_users.inserted} new, ${stats.auth_users.updated} updated`);
      console.log(`  memberships: +${stats.auth_users.memberships}`);
    }

    if (shouldRun("chat")) {
      console.log("\nMigrating chat_history…");
      const rows = sqlite
        .prepare(
          `SELECT id, klant, role, content, afdeling, model, tokens,
                  conversation_id, experiment_id, experiment_variant, latency_ms, created_at
           FROM chat_history`
        )
        .all();

      for (const row of rows) {
        const workspaceId = resolveWorkspaceId(row.klant);
        if (!workspaceId) {
          stats.chat_history.skipped++;
          continue;
        }

        const dup = await sql`
          SELECT id FROM chat_history
          WHERE legacy_sqlite_id = ${String(row.id)} LIMIT 1
        `;
        if (dup.length > 0) {
          stats.chat_history.skipped++;
          continue;
        }

        await sql`
          INSERT INTO chat_history (
            workspace_id, legacy_sqlite_id, klant, role, content, afdeling, model, tokens,
            conversation_id, experiment_id, experiment_variant, latency_ms, created_at
          ) VALUES (
            ${workspaceId}, ${String(row.id)}, ${row.klant}, ${row.role}, ${row.content},
            ${row.afdeling}, ${row.model}, ${row.tokens},
            ${row.conversation_id != null ? String(row.conversation_id) : null},
            ${row.experiment_id != null ? String(row.experiment_id) : null},
            ${row.experiment_variant}, ${row.latency_ms}, ${parseSqliteDate(row.created_at)}
          )
        `;
        stats.chat_history.inserted++;
      }
      console.log(
        `  chat_history: +${stats.chat_history.inserted}, skipped ${stats.chat_history.skipped}`
      );
    }

    if (shouldRun("approvals")) {
      console.log("\nMigrating approvals…");
      const rows = sqlite
        .prepare(
          `SELECT id, title, description, action, payload, status, requested_by,
                  klant, resolved_by, reject_reason, created_at, resolved_at
           FROM approvals`
        )
        .all();

      for (const row of rows) {
        const workspaceId = resolveWorkspaceId(row.klant ?? "system");

        const dup = await sql`
          SELECT id FROM approvals WHERE legacy_sqlite_id = ${String(row.id)} LIMIT 1
        `;
        if (dup.length > 0) {
          stats.approvals.skipped++;
          continue;
        }

        await sql`
          INSERT INTO approvals (
            workspace_id, legacy_sqlite_id, title, description, action, payload, status,
            requested_by, klant, resolved_by, reject_reason, created_at, resolved_at
          ) VALUES (
            ${workspaceId}, ${String(row.id)}, ${row.title}, ${row.description}, ${row.action},
            ${row.payload}, ${row.status ?? "pending"}, ${row.requested_by}, ${row.klant},
            ${row.resolved_by}, ${row.reject_reason},
            ${parseSqliteDate(row.created_at)}, ${parseSqliteDate(row.resolved_at)}
          )
        `;
        stats.approvals.inserted++;
      }
      console.log(
        `  approvals: +${stats.approvals.inserted}, skipped ${stats.approvals.skipped}`
      );
    }

    if (shouldRun("knowledge")) {
      console.log("\nMigrating knowledge_documents…");
      if (!tableExists(sqlite, "knowledge_documents")) {
        console.log("  (table missing in SQLite — skip)");
      } else {
        const rows = sqlite
          .prepare(
            `SELECT id, klant, filename, mime, content_sha256, chunk_count, qdrant_collection,
                    category, tags_json, warnings_json, strategy, max_chunk_chars,
                    canonical_source, created_at
             FROM knowledge_documents`
          )
          .all();

        for (const row of rows) {
          const workspaceId = resolveWorkspaceId(row.klant);
          if (!workspaceId) {
            stats.knowledge_documents.skipped++;
            continue;
          }

          const dup = await sql`
            SELECT id FROM knowledge_documents
            WHERE workspace_id = ${workspaceId} AND content_sha256 = ${row.content_sha256}
            LIMIT 1
          `;
          if (dup.length > 0) {
            stats.knowledge_documents.skipped++;
            continue;
          }

          await sql`
            INSERT INTO knowledge_documents (
              workspace_id, legacy_sqlite_id, klant, filename, mime, content_sha256,
              chunk_count, qdrant_collection, category, tags_json, warnings_json,
              strategy, max_chunk_chars, canonical_source, created_at
            ) VALUES (
              ${workspaceId}, ${String(row.id)}, ${row.klant}, ${row.filename}, ${row.mime},
              ${row.content_sha256}, ${row.chunk_count ?? 0}, ${row.qdrant_collection},
              ${row.category}, ${row.tags_json}, ${row.warnings_json}, ${row.strategy},
              ${row.max_chunk_chars}, ${row.canonical_source}, ${parseSqliteDate(row.created_at)}
            )
          `;
          stats.knowledge_documents.inserted++;
        }
        console.log(
          `  knowledge_documents: +${stats.knowledge_documents.inserted}, skipped ${stats.knowledge_documents.skipped}`
        );
      }
    }

    console.log("\nMigration complete.");
    console.log(JSON.stringify(stats, null, 2));
  } finally {
    await sql.end({ timeout: 5 });
    sqlite.close();
  }
}

function tableExists(db, name) {
  const row = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
    )
    .get(name);
  return Boolean(row);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
