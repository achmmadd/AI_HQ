/** Shared auth session helpers (Edge-safe): signed JSON session + legacy password token fallback. */

import { NextResponse } from "next/server";

export const TOKEN_COOKIE = "motorsai_token";
const SESSION_VERSION = "v2";

export type AuthRole = "admin" | "fumero" | "bokas";
export type WorkspaceScope = "all" | "fumero" | "bokas" | "personal";
export type MembershipRole = "admin" | "editor" | "viewer";

export const SCOPED_KLANTS = ["fumero", "bokas"] as const;
export type ScopedKlant = (typeof SCOPED_KLANTS)[number];

export interface AuthSession {
  userId: number | null;
  email: string;
  role: AuthRole;
  scope: WorkspaceScope;
  /** Default workspace slug (fumero, bokas, motor, personal). Sprint 1.2+. */
  workspaceSlug?: string;
  /** Postgres workspace UUID when DATABASE_URL resolves. */
  workspaceId?: string | null;
  /** Role within workspace (maps workspace_memberships.role). */
  membershipRole?: MembershipRole;
  /** Postgres users.id UUID. */
  pgUserId?: string | null;
  legacy?: boolean;
}

interface AuthSessionPayload extends AuthSession {
  iat: number;
}

function encodeBase64Url(raw: string): string {
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(raw: string): string {
  const b64 = raw.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  const padded = pad ? b64 + "=".repeat(4 - pad) : b64;
  return atob(padded);
}

function getSessionSecret(): string {
  const secret = process.env.MOTORSAI_SESSION_SECRET?.trim();
  if (secret) return secret;
  return `motorsai-session-${getAuthPassword()}`;
}

async function hmacSha256(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  const bytes = new Uint8Array(sig);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return encodeBase64Url(binary);
}

export function encodePasswordAsToken(password: string): string {
  return encodeBase64Url(password);
}

export function getAuthPassword(): string {
  return process.env.MOTORSAI_PASSWORD || "demo123";
}

/** Waarschuwing in productie als default wachtwoord actief is. */
export function assertProductionPassword(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (!process.env.MOTORSAI_PASSWORD?.trim()) {
    console.warn(
      "[Motor AI] MOTORSAI_PASSWORD ontbreekt in productie — default demo123 is actief!"
    );
  }
  if (!process.env.MOTORSAI_SESSION_SECRET?.trim()) {
    console.warn(
      "[Motor AI] MOTORSAI_SESSION_SECRET ontbreekt in productie — stel een unieke secret in."
    );
  }
}

export function getExpectedSessionToken(): string {
  return encodePasswordAsToken(getAuthPassword());
}

function legacySession(token: string): AuthSession | null {
  if (token !== getExpectedSessionToken()) return null;
  return {
    userId: null,
    email: "legacy@motorsai.local",
    role: "admin",
    scope: "all",
    legacy: true,
  };
}

export async function createSignedSessionToken(
  session: AuthSession
): Promise<string> {
  const payload: AuthSessionPayload = {
    ...session,
    iat: Date.now(),
  };
  const payloadText = JSON.stringify(payload);
  const payloadEncoded = encodeBase64Url(payloadText);
  const body = `${SESSION_VERSION}.${payloadEncoded}`;
  const sig = await hmacSha256(body);
  return `${body}.${sig}`;
}

export async function readAuthSession(
  token: string | undefined
): Promise<AuthSession | null> {
  if (!token) return null;
  if (!token.startsWith(`${SESSION_VERSION}.`)) {
    return legacySession(token);
  }

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [version, payloadEncoded, sig] = parts;
  if (version !== SESSION_VERSION || !payloadEncoded || !sig) return null;

  const body = `${version}.${payloadEncoded}`;
  const expectedSig = await hmacSha256(body);
  if (sig !== expectedSig) return null;

  try {
    const payloadRaw = decodeBase64Url(payloadEncoded);
    const payload = JSON.parse(payloadRaw) as Partial<AuthSessionPayload>;
    if (
      typeof payload.email !== "string" ||
      (payload.role !== "admin" &&
        payload.role !== "fumero" &&
        payload.role !== "bokas") ||
      (payload.scope !== "all" &&
        payload.scope !== "fumero" &&
        payload.scope !== "bokas" &&
        payload.scope !== "personal")
    ) {
      return null;
    }
    return {
      userId: typeof payload.userId === "number" ? payload.userId : null,
      email: payload.email,
      role: payload.role,
      scope: payload.scope,
      workspaceSlug:
        typeof payload.workspaceSlug === "string"
          ? payload.workspaceSlug
          : undefined,
      workspaceId:
        typeof payload.workspaceId === "string" ? payload.workspaceId : null,
      membershipRole:
        payload.membershipRole === "admin" ||
        payload.membershipRole === "editor" ||
        payload.membershipRole === "viewer"
          ? payload.membershipRole
          : undefined,
      pgUserId:
        typeof payload.pgUserId === "string" ? payload.pgUserId : null,
      legacy: payload.legacy === true,
    };
  } catch {
    return null;
  }
}

export function isValidSessionToken(token: string | undefined): boolean {
  if (!token) return false;
  if (legacySession(token)) return true;
  if (!token.startsWith(`${SESSION_VERSION}.`)) return false;
  const parts = token.split(".");
  return parts.length === 3 && Boolean(parts[1]) && Boolean(parts[2]);
}

export async function isValidSessionTokenStrict(
  token: string | undefined
): Promise<boolean> {
  return (await readAuthSession(token)) != null;
}

/** Normaliseer klant-parameter naar bekende tenant-id of null. */
export function normalizeScopedKlant(
  klant: string | null | undefined
): ScopedKlant | null {
  const k = (klant || "").trim().toLowerCase();
  if (k === "fumero" || k === "bokas") return k;
  return null;
}

/**
 * Tenant-toegang op basis van sessie:
 * - admin of scope `all` → fumero + bokas
 * - scope `fumero` / `bokas` → alleen die klant
 * - scope `personal` → geen multi-tenant klant-API's (Motor shell)
 */
export function canAccessKlant(session: AuthSession, klant: string): boolean {
  const scoped = normalizeScopedKlant(klant);
  if (!scoped) return false;

  if (session.role === "admin" || session.scope === "all") return true;
  if (session.scope === "personal") return false;
  if (session.scope === "fumero") return scoped === "fumero";
  if (session.scope === "bokas") return scoped === "bokas";
  return false;
}

/** 403 als sessie geen toegang heeft tot `klant`; anders null. */
export function assertScopeAccess(
  session: AuthSession,
  klant: string
): NextResponse | null {
  if (canAccessKlant(session, klant)) return null;
  return NextResponse.json(
    { error: "Forbidden: geen toegang tot deze klant-workspace" },
    { status: 403 }
  );
}
