/**
 * boundary.test.ts — bewijs voor de publieke/private grens van de pilot.
 *
 * Deze tests bewijzen vier dingen, zonder netwerk, model of volumes:
 * 1. Bedrijfsinhoud (review/context/concept) verschijnt NOOIT in evidence
 *    of gateway/store-outcomes — alleen hashes, omvang, status en id's.
 * 2. Onbekende identiteit en verkeerde workspace krijgen altijd 403
 *    (fail-closed, op stabiele node-ID, nooit op een queryparam).
 * 3. Zonder privé contextvolume wordt uitsluitend de expliciete demodata
 *    ("De Linde") gebruikt; mét volume komt context daaruit en nergens anders.
 * 4. De gateway blijft alle externe acties en publicatie weigeren, en de
 *    store-service schrijft principieel niet zonder gateway-settlement.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { IncomingMessage } from "node:http";

import { deepFreeze } from "../lib/adr110/digest.ts";
import type { IsoTimestamp } from "../lib/adr110/types.ts";
import type {
  AdapterInvokeRequest,
  AdapterResult,
  CapabilityAdapter,
} from "../lib/adr110/adapters/contract.ts";
import {
  DEFAULT_CONTEXT,
  resolveContext,
  runDraft,
} from "./draft-core.ts";
import type {
  DraftStoreRecord,
  StoreResult,
  StoreSettlementProof,
} from "./draft-store.ts";
import { accessCheck, parseAcl } from "./server.ts";
import type { NodeIdentity } from "./server.ts";
import { createStoreServer } from "./store-service.ts";

const MARKER_REVIEW = "MARKER-REVIEW-7f3a9c-geheim";
const MARKER_CONTEXT = "MARKER-CONTEXT-b81d2e-bedrijfsgeheim";
const MARKER_DRAFT = "MARKER-DRAFT-c40e51-concepttekst";

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Deterministische fake-adapter: vaste marker-output, geen I/O. */
function createMarkerAdapter(): CapabilityAdapter {
  return deepFreeze({
    adapter_id: "fake-marker",
    adapter_version: "0.0.1",
    capabilities: ["draft.generate"],
    requirements: { data_classes: ["public", "internal"], network: "none" },
    health(now: IsoTimestamp) {
      return {
        adapter_id: "fake-marker",
        adapter_version: "0.0.1",
        status: "ok" as const,
        checked_at: now,
      };
    },
    invoke(request: AdapterInvokeRequest): AdapterResult {
      return {
        ok: true,
        output: MARKER_DRAFT,
        meta: {
          adapter_id: "fake-marker",
          adapter_version: "0.0.1",
          simulated_latency_ms: 1,
          simulated_cost_cents: 0,
          task_id: request.task_id,
          run_id: request.run_id,
          attempt_id: request.attempt_id,
        },
      };
    },
    cancel(attempt_id) {
      return { cancelled: true, attempt_id };
    },
  });
}

interface CapturedStore {
  readonly record: DraftStoreRecord;
  readonly settlement: StoreSettlementProof;
}

function createCapturingStore(): {
  readonly calls: CapturedStore[];
  readonly fn: (
    record: DraftStoreRecord,
    settlement: StoreSettlementProof,
  ) => Promise<StoreResult>;
} {
  const calls: CapturedStore[] = [];
  return {
    calls,
    fn: (record, settlement) => {
      calls.push({ record, settlement });
      return Promise.resolve({ ok: true });
    },
  };
}

test("1. evidence en outcomes bevatten nooit bedrijfsinhoud", async () => {
  const store = createCapturingStore();
  const output = await runDraft(
    { reviewText: MARKER_REVIEW, contextText: MARKER_CONTEXT, isSynthetic: false },
    { adapter: createMarkerAdapter(), storeFn: store.fn, contextFile: false },
  );

  assert.equal(output.ok, true);
  // Het concept zelf is het productoutput voor de geautoriseerde aanroeper…
  assert.equal(output.draft, MARKER_DRAFT);
  // …maar in evidence en outcomes mag geen letter bedrijfsinhoud staan.
  const evidenceJson = JSON.stringify(output.evidence);
  const outcomesJson = JSON.stringify({
    gateway: output.gateway,
    store: output.store,
    manifest: output.manifest,
  });
  for (const marker of [MARKER_REVIEW, MARKER_CONTEXT, MARKER_DRAFT]) {
    assert.ok(
      !evidenceJson.includes(marker),
      `evidence mag geen inhoud bevatten (${marker.slice(0, 18)}…)`,
    );
    assert.ok(
      !outcomesJson.includes(marker),
      `outcomes mogen geen inhoud bevatten (${marker.slice(0, 18)}…)`,
    );
  }
  // In plaats daarvan: hash + omvang + status.
  const artifact = output.evidence.find((e) => e.kind_detail === "adapter.result");
  assert.ok(artifact, "artifact-evidence ontbreekt");
  const data = artifact.data as { output_sha256?: string; output_chars?: number };
  assert.equal(data.output_sha256, sha256(MARKER_DRAFT));
  assert.equal(data.output_chars, MARKER_DRAFT.length);
  // De inhoud bereikt wél de privé-store (dat is de bedoeling), mét settlement.
  assert.equal(store.calls.length, 1);
  assert.equal(store.calls[0].record.review, MARKER_REVIEW);
  assert.equal(store.calls[0].record.draft, MARKER_DRAFT);
  assert.ok(store.calls[0].settlement.receipt_id.length > 0);
});

test("2. onbekende identiteit en verkeerde workspace krijgen altijd 403", async () => {
  const acl = parseAcl('{"nSTABLE123CNTRL":["ws-motor"]}');
  const req = {
    socket: { remoteAddress: "100.64.0.1" },
  } as unknown as IncomingMessage;
  const known: NodeIdentity = { stableId: "nSTABLE123CNTRL", name: "een-node" };

  // Onbekende identiteit (whois faalt of node niet in ACL) → node_not_allowed.
  const unknownNode = await accessCheck(req, "ws-motor", acl, async () => null);
  assert.deepEqual(unknownNode, {
    error: "node_not_allowed",
    ip: "100.64.0.1",
  });
  const notInAcl = await accessCheck(req, "ws-motor", acl, async () => ({
    stableId: "nANDERS999CNTRL",
    name: "onbekend",
  }));
  assert.deepEqual(notInAcl, {
    error: "node_not_allowed",
    ip: "100.64.0.1",
  });

  // Bekende identiteit, verkeerde workspace → unknown_workspace.
  const wrongWs = await accessCheck(req, "ws-anders", acl, async () => known);
  assert.deepEqual(wrongWs, { error: "unknown_workspace", ip: "100.64.0.1" });

  // Bekende identiteit + juiste workspace → grant.
  const granted = await accessCheck(req, "ws-motor", acl, async () => known);
  assert.deepEqual(granted, { workspace: "ws-motor" });

  // Zonder queryparam: server-side default bij precies één workspace…
  const defaulted = await accessCheck(req, null, acl, async () => known);
  assert.deepEqual(defaulted, { workspace: "ws-motor" });
  // …maar nooit gokken bij meerdere workspaces.
  const multi = parseAcl('{"nSTABLE123CNTRL":["ws-motor","ws-2"]}');
  const ambiguous = await accessCheck(req, null, multi, async () => known);
  assert.deepEqual(ambiguous, {
    error: "workspace_required",
    ip: "100.64.0.1",
  });

  // Fail-closed: lege of kapotte ACL laat niemand binnen.
  const empty = await accessCheck(req, "ws-motor", parseAcl(""), async () => known);
  assert.ok("error" in empty);
  const broken = await accessCheck(req, "ws-motor", parseAcl("{geen json"), async () => known);
  assert.ok("error" in broken);
});

test("3. zonder privé contextvolume alleen expliciete demodata", async () => {
  // Geen request-context, volume onleesbaar → demo-fallback.
  const demo = await resolveContext({}, "/bestaat/niet/ondernemer-context.txt");
  assert.equal(demo.source, "demo");
  assert.equal(demo.text, DEFAULT_CONTEXT);

  // Request-context wint altijd.
  const fromRequest = await resolveContext(
    { contextText: MARKER_CONTEXT },
    false,
  );
  assert.equal(fromRequest.source, "request");

  // Volume wordt alleen tijdens runtime gelezen als het er is…
  const dir = await mkdtemp(join(tmpdir(), "pilot-ctx-"));
  try {
    const file = join(dir, "ondernemer-context.txt");
    await writeFile(file, MARKER_CONTEXT, "utf8");
    const fromVolume = await resolveContext({}, file);
    assert.equal(fromVolume.source, "volume");
    assert.equal(fromVolume.text, MARKER_CONTEXT);

    // …en die inhoud belandt nooit in evidence.
    const store = createCapturingStore();
    const output = await runDraft(
      { reviewText: MARKER_REVIEW, isSynthetic: false },
      {
        adapter: createMarkerAdapter(),
        storeFn: store.fn,
        contextFile: file,
      },
    );
    assert.equal(output.contextSource, "volume");
    assert.ok(!JSON.stringify(output.evidence).includes(MARKER_CONTEXT));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("4. gateway blijft publicatie en externe acties weigeren", async () => {
  const store = createCapturingStore();
  const output = await runDraft(
    { reviewText: MARKER_REVIEW, contextText: MARKER_CONTEXT, isSynthetic: false },
    { adapter: createMarkerAdapter(), storeFn: store.fn, contextFile: false },
  );
  assert.equal(output.ok, true);
  // De publish-probe krijgt nooit een receipt → DENY, nooit uitgevoerd.
  assert.equal(output.gateway.publishProbe.executed, false);
  if (!output.gateway.publishProbe.executed) {
    assert.equal(output.gateway.publishProbe.decision, "DENY");
  }
  // De enige ALLOW in deze flow is de interne R0 draft.store met settlement.
  assert.equal(output.store.decision, "ALLOW");
});

test("4b. store-service schrijft principieel niet zonder settlement", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pilot-store-"));
  const file = join(dir, "drafts.jsonl");
  const server = createStoreServer(file);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    // Zonder settlement → 403 en géén bestand.
    const denied = await fetch(`${base}/store`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ record: { run_id: "run-x", draft: "x" } }),
    });
    assert.equal(denied.status, 403);
    await assert.rejects(readFile(file, "utf8"));

    // Met settlement-vorm → 200 en de regel staat in de append-only store.
    const allowed = await fetch(`${base}/store`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        record: {
          stored_at: "2026-08-14T00:00:00.000Z",
          run_id: "run-x",
          receipt_id: "rcpt-x",
          synthetic: true,
          review: "demo",
          draft: "demo-concept",
        },
        settlement: {
          receipt_id: "rcpt-x",
          action_id: "act-x",
          argument_hash: "sha",
          executed_at: "2026-08-14T00:00:00.000Z",
        },
      }),
    });
    assert.equal(allowed.status, 200);
    const written = await readFile(file, "utf8");
    assert.ok(written.includes('"run_id":"run-x"'));
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});
