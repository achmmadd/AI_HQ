import assert from "node:assert/strict";
import test from "node:test";
import { failedResponseToError, fetchJsonOptional } from "./fetch-json-client";

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

test("fetchJsonOptional geeft null bij HTML body", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response("<!DOCTYPE html><html></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    });
  try {
    const data = await fetchJsonOptional<{ ok?: boolean }>("/api/test");
    assert.equal(data, null);
  } finally {
    globalThis.fetch = original;
  }
});
