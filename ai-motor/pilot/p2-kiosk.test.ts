import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

import { P2_PINNED_ORIGIN } from "./p2-bind.ts";
import { evaluateKioskOrigin, healthUrlForPinnedOrigin } from "./p2-kiosk-policy.ts";

const script = readFileSync(join(import.meta.dirname, "../infra/pilot/nuc/motor-p2-kiosk.sh"), "utf8");

function kioskDenyReason(raw: string): string {
  const decision = evaluateKioskOrigin(raw);
  if (decision.ok) throw new Error(`expected deny for ${raw}`);
  return decision.reason;
}

test("P2.0 kiosk accepts only the pinned tailnet /motor origin", () => {
  assert.deepEqual(evaluateKioskOrigin(P2_PINNED_ORIGIN), { ok: true, origin: P2_PINNED_ORIGIN });
  assert.deepEqual(evaluateKioskOrigin(`${P2_PINNED_ORIGIN}/`), { ok: true, origin: P2_PINNED_ORIGIN });
  assert.equal(kioskDenyReason("http://100.97.30.22:4420/"), "wrong_route");
  assert.equal(kioskDenyReason("http://100.97.30.22:4400/motor"), "not_pinned");
  assert.equal(kioskDenyReason("http://203.0.113.10:4420/motor"), "public_ip");
  assert.equal(kioskDenyReason("http://192.168.1.10:4420/motor"), "not_tailnet");
  assert.equal(kioskDenyReason("http://127.0.0.1:4420/motor"), "not_tailnet");
  assert.equal(healthUrlForPinnedOrigin(), "http://100.97.30.22:4420/motor/health");
});

test("P2.0 kiosk script pins the origin, probes health, and has no secrets", () => {
  assert.match(script, /100\.97\.30\.22:4420\/motor/);
  assert.match(script, /\/motor\/health/);
  assert.match(script, /ACTIVATE P2\.0/);
  assert.doesNotMatch(script, /PILOT_STORE_SECRET|TOKEN|BEGIN [A-Z ]*PRIVATE KEY|sk-live/);
  assert.doesNotMatch(script, /docker compose down|0\.0\.0\.0|Access-Control-Allow-Origin/);
  assert.doesNotMatch(script, /ssh |systemctl /);
});
