import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
  createHmac,
} from "crypto";
import { NextResponse } from "next/server";
import db from "@/lib/db/database";
import {
  ensureAppsSchema,
  getPublishedApp,
  getAppBySlug,
} from "@/lib/apps/apps-db";

export const APP_SESSION_VERSION = "app_v1";
const SESSION_DAYS = 30;

export type AppEndUserSession = {
  userId: number;
  email: string;
  appSlug: string;
  klant: string;
  ageVerified: boolean;
};

type AppUserRow = {
  id: number;
  app_slug: string;
  klant: string;
  email: string;
  password_hash: string;
  age_verified: number;
  created_at: string;
  updated_at: string;
};

function safeSlug(slug: string): string {
  return slug.replace(/[^a-z0-9-]/gi, "").toLowerCase();
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

function getSessionSecret(): string {
  const secret = process.env.MOTORSAI_SESSION_SECRET?.trim();
  if (secret) return secret;
  const password = process.env.MOTORSAI_PASSWORD?.trim();
  if (password) return password;
  if (process.env.NODE_ENV === "production") {
    throw new Error("MOTORSAI_SESSION_SECRET of MOTORSAI_PASSWORD vereist in productie");
  }
  return "demo123-dev-only";
}

function encodeBase64Url(raw: string): string {
  return Buffer.from(raw, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64Url(raw: string): string {
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
  return Buffer.from(padded, "base64").toString("utf8");
}

function hmacSha256(message: string): string {
  return createHmac("sha256", getSessionSecret()).update(message).digest("base64url");
}

export function appSessionCookieName(slug: string): string {
  return `motor_app_sess_${safeSlug(slug)}`;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function createAppSessionToken(session: AppEndUserSession): string {
  const payload = {
    v: APP_SESSION_VERSION,
    userId: session.userId,
    email: session.email,
    appSlug: session.appSlug,
    klant: session.klant,
    ageVerified: session.ageVerified,
    iat: Date.now(),
    exp: Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
  const payloadEncoded = encodeBase64Url(JSON.stringify(payload));
  const body = `${APP_SESSION_VERSION}.${payloadEncoded}`;
  const sig = hmacSha256(body);
  return `${body}.${sig}`;
}

export function readAppSessionToken(token: string | undefined): AppEndUserSession | null {
  if (!token || !token.startsWith(`${APP_SESSION_VERSION}.`)) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [, payloadEncoded, sig] = parts;
  const body = `${APP_SESSION_VERSION}.${payloadEncoded}`;
  if (sig !== hmacSha256(body)) return null;
  try {
    const payload = JSON.parse(decodeBase64Url(payloadEncoded)) as {
      userId?: number;
      email?: string;
      appSlug?: string;
      klant?: string;
      ageVerified?: boolean;
      exp?: number;
    };
    if (
      typeof payload.userId !== "number" ||
      typeof payload.email !== "string" ||
      typeof payload.appSlug !== "string" ||
      typeof payload.klant !== "string"
    ) {
      return null;
    }
    if (typeof payload.exp === "number" && payload.exp < Date.now()) return null;
    return {
      userId: payload.userId,
      email: payload.email,
      appSlug: payload.appSlug,
      klant: payload.klant,
      ageVerified: payload.ageVerified === true,
    };
  } catch {
    return null;
  }
}

export function validateRegisterInput(body: {
  email?: string;
  password?: string;
  age_confirmed?: boolean;
}): { ok: true; email: string; password: string } | { ok: false; error: string; field?: string } {
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Vul een geldig e-mailadres in", field: "email" };
  }
  if (password.length < 8) {
    return { ok: false, error: "Wachtwoord moet minstens 8 tekens zijn", field: "password" };
  }
  if (!body.age_confirmed) {
    return {
      ok: false,
      error: "Je moet bevestigen dat je 18 jaar en ouder bent",
      field: "age_confirmed",
    };
  }
  return { ok: true, email, password };
}

export function validateLoginInput(body: {
  email?: string;
  password?: string;
}): { ok: true; email: string; password: string } | { ok: false; error: string; field?: string } {
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email) {
    return { ok: false, error: "E-mailadres is verplicht", field: "email" };
  }
  if (!password) {
    return { ok: false, error: "Wachtwoord is verplicht", field: "password" };
  }
  return { ok: true, email, password };
}

function resolveAppForAuth(
  slug: string,
  klant?: string | null
): { app_slug: string; klant: string } | null {
  const safe = safeSlug(slug);
  if (klant) {
    const app = getAppBySlug(safe, klant);
    if (app && app.status !== "archived") return { app_slug: safe, klant };
    return null;
  }
  const published = getPublishedApp(safe);
  if (published) return { app_slug: safe, klant: published.klant };
  return null;
}

export function registerAppUser(
  slug: string,
  klant: string | null | undefined,
  email: string,
  password: string,
  ageVerified: boolean
): { ok: true; user: AppUserRow } | { ok: false; error: string; field?: string } {
  ensureAppsSchema();
  const scope = resolveAppForAuth(slug, klant);
  if (!scope) {
    return { ok: false, error: "App niet gevonden of niet gepubliceerd" };
  }

  const existing = db
    .prepare(
      `SELECT id FROM app_users WHERE klant = ? AND app_slug = ? AND email = ?`
    )
    .get(scope.klant, scope.app_slug, email) as { id: number } | undefined;
  if (existing) {
    return { ok: false, error: "Dit e-mailadres is al geregistreerd", field: "email" };
  }

  const hash = makeHash(password);
  const ins = db
    .prepare(
      `INSERT INTO app_users (app_slug, klant, email, password_hash, age_verified)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(scope.app_slug, scope.klant, email, hash, ageVerified ? 1 : 0);

  const user = db
    .prepare(`SELECT * FROM app_users WHERE id = ?`)
    .get(Number(ins.lastInsertRowid)) as AppUserRow;

  return { ok: true, user };
}

export function loginAppUser(
  slug: string,
  klant: string | null | undefined,
  email: string,
  password: string
): { ok: true; user: AppUserRow } | { ok: false; error: string; field?: string } {
  ensureAppsSchema();
  const scope = resolveAppForAuth(slug, klant);
  if (!scope) {
    return { ok: false, error: "App niet gevonden of niet gepubliceerd" };
  }

  const user = db
    .prepare(
      `SELECT * FROM app_users WHERE klant = ? AND app_slug = ? AND email = ?`
    )
    .get(scope.klant, scope.app_slug, email) as AppUserRow | undefined;

  if (!user || !verifyHash(password, user.password_hash)) {
    return { ok: false, error: "Onjuist e-mailadres of wachtwoord", field: "email" };
  }
  if (!user.age_verified) {
    return {
      ok: false,
      error: "Je moet bevestigen dat je 18 jaar en ouder bent om in te loggen",
      field: "age_confirmed",
    };
  }

  return { ok: true, user };
}

export function createAppSession(user: AppUserRow): string {
  ensureAppsSchema();
  const token = createAppSessionToken({
    userId: user.id,
    email: user.email,
    appSlug: user.app_slug,
    klant: user.klant,
    ageVerified: user.age_verified === 1,
  });
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  db.prepare(
    `INSERT INTO app_sessions (token_hash, user_id, app_slug, klant, expires_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(hashToken(token), user.id, user.app_slug, user.klant, expiresAt);
  return token;
}

export function revokeAppSession(token: string | undefined): void {
  if (!token) return;
  ensureAppsSchema();
  db.prepare(`DELETE FROM app_sessions WHERE token_hash = ?`).run(hashToken(token));
}

export function sessionResponse(
  user: AppUserRow,
  token: string
): NextResponse {
  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      age_verified: user.age_verified === 1,
    },
  });
  res.cookies.set(appSessionCookieName(user.app_slug), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return res;
}

export function logoutResponse(slug: string): NextResponse {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(appSessionCookieName(slug), "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

export function readAppSessionFromCookie(
  cookieValue: string | undefined,
  expectedSlug: string,
  expectedKlant?: string
): AppEndUserSession | null {
  const session = readAppSessionToken(cookieValue);
  if (!session) return null;
  if (session.appSlug !== safeSlug(expectedSlug)) return null;
  if (expectedKlant && session.klant !== expectedKlant) return null;
  return session;
}
