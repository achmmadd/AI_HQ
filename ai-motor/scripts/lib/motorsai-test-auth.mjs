/** Test-only session token (no Next.js imports). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
  }
}

function encodeBase64Url(raw) {
  return Buffer.from(raw, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getSessionSecret() {
  const secret = process.env.MOTORSAI_SESSION_SECRET?.trim();
  if (secret) return secret;
  const configured = process.env.MOTORSAI_PASSWORD?.trim();
  const password = configured || (process.env.NODE_ENV === "production" ? "" : "demo123");
  return `motorsai-session-${password}`;
}

async function hmacSha256(message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return encodeBase64Url(String.fromCharCode(...new Uint8Array(sig)));
}

export async function createFumeroTestToken() {
  const payload = {
    userId: 1,
    email: "e2e.bouwen@motorsai.local",
    role: "fumero",
    scope: "fumero",
    iat: Date.now(),
  };
  const body = `v2.${encodeBase64Url(JSON.stringify(payload))}`;
  const sig = await hmacSha256(body);
  return `${body}.${sig}`;
}

/** Prefer login cookie — matches running server's session secret. */
export async function createFumeroTestCookie(baseUrl) {
  const explicit = process.env.MOTORSAI_TOKEN?.trim();
  if (explicit) return `motorsai_token=${explicit}`;

  const password = process.env.MOTORSAI_PASSWORD?.trim();
  if (password) {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.token) return `motorsai_token=${json.token}`;
  }

  const token = await createFumeroTestToken();
  return `motorsai_token=${token}`;
}
