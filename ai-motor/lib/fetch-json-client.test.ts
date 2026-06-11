import assert from "node:assert/strict";
import test from "node:test";
import { failedResponseToError } from "./fetch-json-client";

test("failedResponseToError leest JSON error+detail", () => {
  const e = failedResponseToError(
    JSON.stringify({ error: "bad", detail: "x" }),
    400
  );
  assert.equal(e.message, "bad — x");
});

test("failedResponseToError herkent Cloudflare 524 HTML", () => {
  const e = failedResponseToError(
    "<!DOCTYPE html><title>524: A timeout occurred</title>",
    524
  );
  assert.match(e.message, /524/);
});

test("failedResponseToError valt terug op plain text", () => {
  const e = failedResponseToError("niet-json", 502);
  assert.equal(e.message, "niet-json");
});
