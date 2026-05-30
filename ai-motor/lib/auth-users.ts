import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import db from "@/lib/db/database";
import type { AuthRole, WorkspaceScope } from "@/lib/auth-session";

type AuthUserRow = {
  id: number;
  email: string;
  password_hash: string;
  role: AuthRole;
  scope: WorkspaceScope;
  active: number;
};

type SessionUser = {
  id: number;
  email: string;
  role: AuthRole;
  scope: WorkspaceScope;
};

function ensureAuthUsersTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'fumero'
        CHECK (role IN ('admin', 'fumero', 'bokas')),
      scope TEXT NOT NULL DEFAULT 'fumero'
        CHECK (scope IN ('all', 'fumero', 'bokas', 'personal')),
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);
  `);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function makeHash(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${digest}`;
}

function verifyHash(password: string, hash: string): boolean {
  const [alg, salt, expected] = hash.split(":");
  if (alg !== "scrypt" || !salt || !expected) return false;
  const digest = scryptSync(password, salt, 64);
  const expectedBuf = Buffer.from(expected, "hex");
  if (digest.length !== expectedBuf.length) return false;
  return timingSafeEqual(digest, expectedBuf);
}

function mapRow(row: AuthUserRow): SessionUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    scope: row.scope,
  };
}

function parseEnvSeed(): Array<{
  email: string;
  password: string;
  role: AuthRole;
  scope: WorkspaceScope;
}> {
  const raw = process.env.MOTORSAI_AUTH_USERS?.trim();
  if (!raw) return [];
  const isRole = (value: unknown): value is AuthRole =>
    value === "admin" || value === "fumero" || value === "bokas";
  const isScope = (value: unknown): value is WorkspaceScope =>
    value === "all" ||
    value === "fumero" ||
    value === "bokas" ||
    value === "personal";
  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const email =
          typeof item.email === "string" ? normalizeEmail(item.email) : "";
        const password =
          typeof item.password === "string" ? item.password.trim() : "";
        const role = item.role;
        const scope = item.scope;
        if (!email || !password) return null;
        if (!isRole(role) || !isScope(scope)) return null;
        return { email, password, role, scope };
      })
      .filter((v): v is NonNullable<typeof v> => Boolean(v));
  } catch {
    return [];
  }
}

/** Seed from env, non-destructive: adds only missing emails. */
export function seedAuthUsersFromEnv(): void {
  ensureAuthUsersTable();
  const seeds = parseEnvSeed();
  if (seeds.length === 0) return;
  const existing = db
    .prepare("SELECT email FROM auth_users")
    .all() as Array<{ email: string }>;
  const existingSet = new Set(existing.map((r) => normalizeEmail(r.email)));
  const ins = db.prepare(
    `INSERT INTO auth_users (email, password_hash, role, scope, active)
     VALUES (?,?,?,?,1)`
  );
  for (const seed of seeds) {
    if (existingSet.has(seed.email)) continue;
    ins.run(seed.email, makeHash(seed.password), seed.role, seed.scope);
  }
}

export function createAuthUser(params: {
  email: string;
  password: string;
  role: AuthRole;
  scope: WorkspaceScope;
}): SessionUser {
  ensureAuthUsersTable();
  const email = normalizeEmail(params.email);
  const password = params.password.trim();
  if (!email || !password) {
    throw new Error("email and password required");
  }
  const result = db
    .prepare(
      `INSERT INTO auth_users (email, password_hash, role, scope, active)
       VALUES (?,?,?,?,1)`
    )
    .run(email, makeHash(password), params.role, params.scope);
  return {
    id: Number(result.lastInsertRowid),
    email,
    role: params.role,
    scope: params.scope,
  };
}

export function authenticateUser(
  emailInput: string,
  passwordInput: string
): SessionUser | null {
  ensureAuthUsersTable();
  const email = normalizeEmail(emailInput);
  const password = passwordInput ?? "";
  if (!email || !password) return null;
  const row = db
    .prepare(
      "SELECT id, email, password_hash, role, scope, active FROM auth_users WHERE email = ?"
    )
    .get(email) as AuthUserRow | undefined;
  if (!row || row.active !== 1) return null;
  if (!verifyHash(password, row.password_hash)) return null;
  return mapRow(row);
}

ensureAuthUsersTable();
