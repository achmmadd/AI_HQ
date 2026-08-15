/**
 * Security-track P0.6 — cross-container store-grens (aanvalspunt 10).
 *
 * Te bewijzen: de store-service accepteert GEEN ENKEL bericht zonder geldig
 * v2-settlement — ook niet vanaf het "vertrouwde" netwerk. Localhost is een
 * netwerkadres, geen credential. Daarnaast wordt de localhost-aanname zelf
 * expliciet gemaakt: de service bindt uitsluitend op 127.0.0.1 en is via
 * geen enkel niet-loopback-adres bereikbaar.
 *
 *  - S10a: statische guard — de service bindt alleen op 127.0.0.1.
 *  - S10b: functioneel — vanaf loopback zelf (de aanvaller zit al "binnen"):
 *    geen settlement / incomplete settlement / v1 / verlopen / verkeerde
 *    sleutel / payload-swap / replay → altijd 4xx, nooit een write.
 *  - S10c: zonder geldig runtime-secret is de store fail-closed (503).
 *  - S10d: malformed/oversized/verkeerde-methoden → gecontroleerde fout,
 *    server blijft leven, er wordt niets geschreven.
 *  - S10e: bewijs van de localhost-aanname — een server op 127.0.0.1 is via
 *    het eerste niet-loopback IPv4-adres van de host niet bereikbaar.
 *
 * Alles synthetisch; eigen test-secret, geen echte data.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { networkInterfaces, tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createStoreServer } from "../store-service.ts";
import { signSettlement } from "../settlement.ts";
import type { SettlementBase } from "../settlement.ts";

const SECRET = "0123456789abcdef".repeat(4);
const WRONG_SECRET = "ffffffffffffffff".repeat(4);

interface StoreServerHandle {
  readonly url: string;
  readonly port: number;
  readonly dir: string;
  readonly storePath: string;
  close(): Promise<void>;
}

async function startStore(
  options: { secret?: string } = {},
): Promise<StoreServerHandle> {
  const dir = await mkdtemp(join(tmpdir(), "pilot-s10-"));
  const storePath = join(dir, "drafts.jsonl");
  const server = createStoreServer(storePath, { secret: options.secret ?? SECRET });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    port: address.port,
    dir,
    storePath,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

function draftRecord(runId = "run-s10"): Record<string, unknown> {
  return {
    type: "draft",
    stored_at: new Date().toISOString(),
    run_id: runId,
    receipt_id: "rcpt-s10",
    synthetic: true,
    review: "synthetische review",
    draft: "synthetisch concept",
  };
}

function settlementBase(runId = "run-s10"): SettlementBase {
  const now = new Date().toISOString();
  return {
    receipt_id: "rcpt-s10",
    action_id: "act-s10",
    argument_hash: "a".repeat(64),
    executed_at: now,
    capability: "draft.store",
    tool: "draft.store.local",
    workspace_id: "ws-motor",
    task_id: "task-s10",
    run_id: runId,
    attempt_id: "att-s10",
    policy_id: "policy-motor-default",
    policy_version: "1.1.0",
    policy_digest: "b".repeat(64),
    issued_at: now,
  };
}

async function postStore(
  url: string,
  body: unknown,
): Promise<{ status: number; json: { ok?: boolean; error?: string } }> {
  const res = await fetch(`${url}/store`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as { ok?: boolean; error?: string } };
}

async function storedLines(storePath: string): Promise<string[]> {
  try {
    const raw = await readFile(storePath, "utf8");
    return raw.split("\n").filter((l) => l.trim().length > 0);
  } catch {
    return [];
  }
}

test("S10a. statische guard: de store bindt uitsluitend op 127.0.0.1", async () => {
  const url = new URL("../store-service.ts", import.meta.url);
  const raw = await readFile(url, "utf8");
  const code = raw
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
  assert.ok(
    /server\.listen\(PORT,\s*"127\.0\.0\.1"/.test(code),
    "de store moet expliciet op 127.0.0.1 binden",
  );
  assert.ok(!/0\.0\.0\.0/.test(code), "geen 0.0.0.0-binding in de store");
  assert.ok(
    !/\.listen\(\s*PORT\s*\)/.test(code),
    "listen zonder expliciete host zou op alle interfaces binden",
  );
  assert.ok(
    !/\.listen\(\s*PORT\s*,\s*"::"/.test(code),
    "geen IPv6 wildcard-binding",
  );
});

test("S10b. vanaf 'vertrouwd' loopback: zonder geldig v2-settlement schrijft de store nooit", async () => {
  const server = await startStore();
  try {
    // 1. Helemaal geen settlement.
    let r = await postStore(server.url, { record: draftRecord() });
    assert.equal(r.status, 403);
    assert.equal(r.json.error, "settlement_required");

    // 2. Incomplete settlement (signature ontbreekt).
    const { signature: _sig, ...unsigned } = signSettlement(
      SECRET,
      settlementBase(),
      draftRecord(),
    );
    r = await postStore(server.url, { record: draftRecord(), settlement: unsigned });
    assert.equal(r.status, 403);
    assert.equal(r.json.error, "settlement_required");

    // 3. Oude protocolversie.
    const v1 = { ...signSettlement(SECRET, settlementBase(), draftRecord()), v: "v1" };
    r = await postStore(server.url, { record: draftRecord(), settlement: v1 });
    assert.equal(r.status, 403);
    assert.equal(r.json.error, "unsupported_version");

    // 4. Verlopen bewijs (60 s TTL overschreden).
    const expired = signSettlement(
      SECRET,
      settlementBase(),
      draftRecord(),
      Date.now() - 120_000,
    );
    r = await postStore(server.url, { record: draftRecord(), settlement: expired });
    assert.equal(r.status, 403);
    assert.equal(r.json.error, "settlement_expired");

    // 5. Geldige vorm, verkeerde sleutel.
    const wrongKey = signSettlement(WRONG_SECRET, settlementBase(), draftRecord());
    r = await postStore(server.url, { record: draftRecord(), settlement: wrongKey });
    assert.equal(r.status, 403);
    assert.equal(r.json.error, "bad_signature");

    // 6. Payload-swap: settlement voor record A, record B ingestuurd.
    const forA = signSettlement(SECRET, settlementBase("run-A"), draftRecord("run-A"));
    r = await postStore(server.url, { record: draftRecord("run-B"), settlement: forA });
    assert.equal(r.status, 403);
    assert.equal(r.json.error, "record_mismatch");

    // 7. Replay: een volledig geldig settlement twee keer insturen.
    const valid = signSettlement(SECRET, settlementBase(), draftRecord());
    const first = await postStore(server.url, { record: draftRecord(), settlement: valid });
    assert.equal(first.status, 200, "testopstelling: eerste write slaagt");
    const replay = await postStore(server.url, { record: draftRecord(), settlement: valid });
    assert.equal(replay.status, 403);
    assert.equal(replay.json.error, "settlement_replayed");

    // Na al deze aanvallen staat er precies één legitieme regel in de store.
    assert.equal(
      (await storedLines(server.storePath)).length,
      1,
      "alleen de legitieme write mag landen",
    );
  } finally {
    await server.close();
    await rm(server.dir, { recursive: true, force: true });
  }
});

test("S10c. zonder geldig runtime-secret is de store fail-closed", async () => {
  const server = await startStore({ secret: "" });
  try {
    const valid = signSettlement(SECRET, settlementBase(), draftRecord());
    const r = await postStore(server.url, { record: draftRecord(), settlement: valid });
    assert.equal(r.status, 503);
    assert.equal(r.json.error, "store_not_configured");
    assert.equal((await storedLines(server.storePath)).length, 0);
  } finally {
    await server.close();
    await rm(server.dir, { recursive: true, force: true });
  }
});

test("S10d. malformed/oversized/verkeerde methode → gecontroleerde fout, geen write, geen crash", async () => {
  const server = await startStore();
  try {
    // Verkeerde methode op /store en bestaande/bestandsloze paden → 404.
    const get = await fetch(`${server.url}/store`);
    assert.equal(get.status, 404);
    const unknown = await fetch(`${server.url}/admin`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assert.equal(unknown.status, 404);

    // Kapotte JSON → gecontroleerde 500, geen crash.
    const badJson = await postStore(server.url, "{kapot");
    assert.equal(badJson.status, 500);

    // Te grote body (> 64 KiB) → gecontroleerde fout, geen write.
    const big = await postStore(server.url, JSON.stringify({ record: "x".repeat(70 * 1024) }));
    assert.equal(big.status, 500);
    assert.match(big.json.error ?? "", /too large/);

    // De server leeft nog en schrijft nog steeds alleen met geldig bewijs.
    const health = await fetch(`${server.url}/health`);
    assert.equal(health.status, 200);
    assert.equal((await storedLines(server.storePath)).length, 0);
  } finally {
    await server.close();
    await rm(server.dir, { recursive: true, force: true });
  }
});

test("S10e. localhost-aanname expliciet: geen bereik via niet-loopback interface", async () => {
  const server = await startStore();
  try {
    const external = Object.values(networkInterfaces())
      .flat()
      .find((i) => i && i.family === "IPv4" && !i.internal);
    if (!external) {
      // Geen niet-loopback interface in deze omgeving: de statische guard
      // (S10a) en de compose-guard (S3c) dragen dan het bewijs.
      return;
    }
    let reached = false;
    try {
      await fetch(`http://${external.address}:${server.port}/health`, {
        signal: AbortSignal.timeout(2_000),
      });
      reached = true;
    } catch {
      // Verwacht: connection refused — de store luistert niet op dit adres.
    }
    assert.equal(
      reached,
      false,
      `store op 127.0.0.1 mocht niet via ${external.address} bereikbaar zijn`,
    );
  } finally {
    await server.close();
    await rm(server.dir, { recursive: true, force: true });
  }
});
