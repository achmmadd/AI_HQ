#!/usr/bin/env node
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

const base = (process.env.BASE_URL || "http://127.0.0.1:3040").replace(/\/$/, "");
const token = await createSignedSessionToken({
  userId: 1,
  email: "test.fumero@motorsai.local",
  role: "fumero",
  scope: "fumero",
});
const headers = {
  "x-motorsai-token": token,
  "Content-Type": "application/json",
};

const imp = await fetch(`${base}/api/photo-studio/brand-kit/import`, {
  method: "POST",
  headers,
  body: JSON.stringify({
    klant: "fumero",
    url: "https://fumero.nl/product/kings-hhc-disposable-vape-super-lemon-haze-500mg/",
  }),
});
const impText = await imp.text();
let impJ;
try {
  impJ = JSON.parse(impText);
} catch {
  console.error("IMPORT non-JSON", imp.status, impText.slice(0, 400));
  process.exit(1);
}
console.log("IMPORT status:", imp.status, "ok:", impJ.ok, "price:", impJ.draft?.price, "error:", impJ.error);

const kits = await fetch(`${base}/api/photo-studio/brand-kit?klant=fumero`, { headers });
const kitsJ = await kits.json();
const confirmed = (kitsJ.items || []).filter((k) => k.status === "confirmed");
console.log("KITS confirmed:", confirmed.length, "/", kitsJ.items?.length);

const cfg = await fetch(`${base}/api/fumero/campaign/generate`, { headers });
const cfgJ = await cfg.json();
console.log(
  "CONFIG skip_media default:",
  cfgJ.config?.default_skip_media,
  "template:",
  cfgJ.config?.template_only
);

if (impJ.draft?.price !== "24.95") {
  console.error("FAIL import price");
  process.exit(1);
}
if (!confirmed.length) {
  console.warn("WARN: no confirmed kits for campaign test");
}
console.log("POST-DEPLOY API OK");
