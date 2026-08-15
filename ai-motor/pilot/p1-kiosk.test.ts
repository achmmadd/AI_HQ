import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const script = readFileSync(
  join(import.meta.dirname, "../infra/pilot/nuc/motor-shell-kiosk.sh"),
  "utf8",
);

test("P1.7 kiosk prep is /motor-only and does not deploy", () => {
  assert.match(script, /MOTOR_SHELL_URL/);
  assert.match(script, /\/motor/);
  assert.match(script, /exit 0/);
  assert.doesNotMatch(script, /docker |ssh |systemctl |curl /);
  assert.doesNotMatch(script, /100\.\d+\.\d+\.\d+/);
  assert.doesNotMatch(script, /Access-Control-Allow-Origin/);
  assert.match(script, /GEEN activatie|niet zonder eigenaarsopdracht/);
});
