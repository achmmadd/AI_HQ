import assert from "node:assert/strict";
import test from "node:test";
import {
  createAppSessionToken,
  readAppSessionToken,
  validateLoginInput,
  validateRegisterInput,
  appSessionCookieName,
} from "@/lib/apps/app-auth";

test("validateRegisterInput requires email, password and 18+", () => {
  const bad = validateRegisterInput({ email: "x", password: "short" });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.match(bad.error, /e-mail/i);

  const noAge = validateRegisterInput({
    email: "test@fumero.nl",
    password: "geheim123",
    age_confirmed: false,
  });
  assert.equal(noAge.ok, false);
  if (!noAge.ok) assert.match(noAge.error, /18 jaar en ouder/i);

  const ok = validateRegisterInput({
    email: "Test@Fumero.nl",
    password: "geheim123",
    age_confirmed: true,
  });
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.email, "test@fumero.nl");
});

test("validateLoginInput requires email and password", () => {
  const bad = validateLoginInput({});
  assert.equal(bad.ok, false);

  const ok = validateLoginInput({
    email: "user@fumero.nl",
    password: "geheim123",
  });
  assert.equal(ok.ok, true);
});

test("app session token round-trip", () => {
  const token = createAppSessionToken({
    userId: 42,
    email: "user@fumero.nl",
    appSlug: "demo-shop",
    klant: "fumero",
    ageVerified: true,
  });
  const session = readAppSessionToken(token);
  assert.ok(session);
  assert.equal(session!.userId, 42);
  assert.equal(session!.appSlug, "demo-shop");
  assert.equal(session!.ageVerified, true);

  assert.equal(readAppSessionToken("invalid"), null);
});

test("appSessionCookieName is slug-scoped", () => {
  assert.equal(appSessionCookieName("My-App"), "motor_app_sess_my-app");
});
