#!/usr/bin/env node
/** Quick curl-style probe: fumero scope vs /api/apps* and /api/fumero/tools */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSignedSessionToken } from "../lib/auth-session.ts";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
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

const token = await createSignedSessionToken({
  userId: 1,
  email: "test.fumero@motorsai.local",
  role: "fumero",
  scope: "fumero",
});

const cookie = `motorsai_token=${token}`;
const port = process.argv[2] || process.env.PORT || "3040";
const base = `http://127.0.0.1:${port}`;

const probes = [
  { method: "GET", path: "/api/apps" },
  { method: "POST", path: "/api/apps/generate", body: { prompt: "maak test" } },
  { method: "GET", path: "/api/fumero/tools" },
  { method: "GET", path: "/api/conversations?klant=fumero" },
];

for (const p of probes) {
  const res = await fetch(`${base}${p.path}`, {
    method: p.method,
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: p.body ? JSON.stringify(p.body) : undefined,
  });
  const text = await res.text();
  let summary = text.slice(0, 160);
  try {
    const j = JSON.parse(text);
    summary = j.error || JSON.stringify(j).slice(0, 160);
  } catch {
    /* html */
  }
  console.log(`${port} ${p.method} ${p.path} → ${res.status} ${summary}`);
}
