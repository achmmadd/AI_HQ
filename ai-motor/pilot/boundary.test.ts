/**
 * boundary.test.ts — bewijs voor de publieke/private grens van de pilot.
 *
 * Deze tests bewijzen vijf dingen, zonder netwerk, model of volumes:
 * 1. Bedrijfsinhoud (review/context/concept) verschijnt NOOIT in evidence
 *    of gateway/store-outcomes — alleen hashes, omvang, status en id's.
 * 2. Onbekende identiteit en verkeerde workspace krijgen altijd 403
 *    (fail-closed, op stabiele node-ID, nooit op een queryparam).
 * 3. CONTEXT_MODE bepaalt de contextbron: demo gebruikt nooit het volume,
 *    private vereist het volume (geen stille fallback), en de browser kan
 *    nooit context meesturen (400) of een niet-JSON content-type (415).
 * 4. De gateway blijft alle externe acties en publicatie weigeren.
 * 5. De store-service accepteert alleen authentieke settlements: HMAC-
 *    ondertekend, payload-gebonden, niet verlopen en eenmalig — en is
 *    fail-closed zonder geconfigureerd secret.
 * 6. Koppeling 2 (draft.decision): beslissingen vereisen een bestaand
 *    concept, landen via getekend settlement in decisions.jsonl, zijn
 *    first-decision-wins, en de operator-notitie komt nooit in evidence.
 * 7. Spoor-A adversariële review: CONTEXT_MODE fail-closed, per-veld-tamper
 *    op het v2-settlement, settlement-race (exactly-once claim), crash na
 *    claim vóór append (at-most-once), beslis-race op hetzelfde concept,
 *    publish blijft gesloten na approval, en de compose-mountmatrix.
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
  ADR110_SCHEMA_VERSION,
  branded,
  isoTimestamp,
} from "../lib/adr110/index.ts";
import type {
  ActionRequest,
  AttemptId,
  EmployeeId,
  RunId,
  TaskId,
  WorkspaceId,
} from "../lib/adr110/index.ts";
import { createGateway } from "../lib/adr110/gateway.ts";
import {
  DEFAULT_CONTEXT,
  buildPilotPolicy,
  contextModeFromEnv,
  runDraft,
} from "./draft-core.ts";
import type {
  DraftStoreRecord,
  StoreRecord,
  StoreResult,
  StoreSettlementProof,
} from "./draft-store.ts";
import { accessCheck, createPilotServer, parseAcl } from "./server.ts";
import type { NodeIdentity } from "./server.ts";
import { signSettlement } from "./settlement.ts";
import type { SettlementBase } from "./settlement.ts";
import { createStoreServer } from "./store-service.ts";
import { runDecision } from "./decision-core.ts";
import {
  listDecisions,
  listDrafts,
  storeDraftViaService,
} from "./draft-store.ts";

const MARKER_REVIEW = "MARKER-REVIEW-7f3a9c-geheim";
const MARKER_CONTEXT = "MARKER-CONTEXT-b81d2e-bedrijfsgeheim";
const MARKER_DRAFT = "MARKER-DRAFT-c40e51-concepttekst";
// Geldig test-secret: exact 64 lowercase hex-karakters (32 bytes).
const SECRET = "0123456789abcdef".repeat(4);

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Deterministische fake-adapter: vaste marker-output, geen I/O. */
function createMarkerAdapter(): {
  readonly adapter: CapabilityAdapter;
  readonly prompts: string[];
} {
  const prompts: string[] = [];
  const adapter: CapabilityAdapter = deepFreeze({
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
      prompts.push(request.input);
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
  return { adapter, prompts };
}

interface CapturedStore {
  readonly record: StoreRecord;
  readonly settlement: StoreSettlementProof;
}

function createCapturingStore(): {
  readonly calls: CapturedStore[];
  readonly fn: (
    record: StoreRecord,
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
  const dir = await mkdtemp(join(tmpdir(), "pilot-ctx-"));
  try {
    const contextFile = join(dir, "ondernemer-context.txt");
    await writeFile(contextFile, MARKER_CONTEXT, "utf8");
    const { adapter } = createMarkerAdapter();
    const store = createCapturingStore();
    const output = await runDraft(
      { reviewText: MARKER_REVIEW, isSynthetic: false },
      {
        adapter,
        storeFn: store.fn,
        contextMode: "private",
        contextFile,
        storeSecret: SECRET,
      },
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
    // De inhoud bereikt wél de privé-store (dat is de bedoeling), mét een
    // ondertekend settlement (signatuur + expiry + payload-binding).
    assert.equal(store.calls.length, 1);
    const captured = store.calls[0].record;
    assert.ok("review" in captured && "draft" in captured);
    assert.equal(captured.review, MARKER_REVIEW);
    assert.equal(captured.draft, MARKER_DRAFT);
    assert.ok(store.calls[0].settlement.receipt_id.length > 0);
    assert.equal(typeof store.calls[0].settlement.signature, "string");
    assert.equal(typeof store.calls[0].settlement.expires_at, "string");
    assert.equal(typeof store.calls[0].settlement.record_sha256, "string");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
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

test("3a. CONTEXT_MODE=demo gebruikt nooit het privé-volume", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pilot-ctx-"));
  try {
    const contextFile = join(dir, "ondernemer-context.txt");
    await writeFile(contextFile, MARKER_CONTEXT, "utf8");
    const { adapter, prompts } = createMarkerAdapter();
    const output = await runDraft(
      { reviewText: MARKER_REVIEW, isSynthetic: true },
      {
        adapter,
        storeFn: createCapturingStore().fn,
        contextMode: "demo",
        contextFile,
        storeSecret: SECRET,
      },
    );
    assert.equal(output.ok, true);
    assert.equal(output.contextSource, "demo");
    assert.equal(prompts.length, 1);
    assert.ok(
      !prompts[0].includes(MARKER_CONTEXT),
      "demo-mode las toch het privé-volume",
    );
    assert.ok(prompts[0].includes("De Linde"), "demo-mode gebruikt de demodata");
    assert.equal(DEFAULT_CONTEXT.includes("De Linde"), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("3b. CONTEXT_MODE=private leest het volume; ontbreken/lege file faalt expliciet", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pilot-ctx-"));
  try {
    const contextFile = join(dir, "ondernemer-context.txt");
    await writeFile(contextFile, MARKER_CONTEXT, "utf8");
    const { adapter, prompts } = createMarkerAdapter();
    const output = await runDraft(
      { reviewText: MARKER_REVIEW, isSynthetic: false },
      {
        adapter,
        storeFn: createCapturingStore().fn,
        contextMode: "private",
        contextFile,
        storeSecret: SECRET,
      },
    );
    assert.equal(output.ok, true);
    assert.equal(output.contextSource, "volume");
    assert.ok(
      prompts[0].includes(MARKER_CONTEXT),
      "private-mode moet de volumecontext in de prompt gebruiken",
    );
    // …en die inhoud belandt nooit in evidence.
    assert.ok(!JSON.stringify(output.evidence).includes(MARKER_CONTEXT));

    // Geen stille fallback: ontbrekend bestand → expliciete fout.
    await assert.rejects(
      runDraft(
        { reviewText: "x", isSynthetic: true },
        {
          adapter: createMarkerAdapter().adapter,
          contextMode: "private",
          contextFile: join(dir, "ontbreekt.txt"),
        },
      ),
      /context_unavailable_private_mode/,
    );

    // Leeg bestand → expliciete fout, nooit stil naar demo.
    await writeFile(join(dir, "leeg.txt"), "  \n", "utf8");
    await assert.rejects(
      runDraft(
        { reviewText: "x", isSynthetic: true },
        {
          adapter: createMarkerAdapter().adapter,
          contextMode: "private",
          contextFile: join(dir, "leeg.txt"),
        },
      ),
      /context_empty_private_mode/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("3c. HTTP: /draft weigert niet-JSON (415) en meegestuurde context (400)", async () => {
  const server = createPilotServer({
    acl: parseAcl('{"nPIETJE123CNTRL":["ws-motor"]}'),
    resolveNode: async () => ({ stableId: "nPIETJE123CNTRL", name: "pietje" }),
    runDraftImpl: (async () => ({ ok: true, draft: "x" })) as never,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    // "Simple request" (text/plain) zou zonder preflight cross-origin kunnen
    // worden verstuurd — daarom alleen application/json toegestaan.
    const plain = await fetch(`${base}/draft`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "review=x",
    });
    assert.equal(plain.status, 415);
    assert.equal((await plain.json()).error, "content_type_must_be_json");

    // Context hoort nooit in het request: expliciet geweigerd, niet genegeerd.
    const withContext = await fetch(`${base}/draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ review: "x", context: MARKER_CONTEXT }),
    });
    assert.equal(withContext.status, 400);
    assert.equal(
      (await withContext.json()).error,
      "context_via_request_not_allowed",
    );

    // En er is nooit een CORS-header die cross-origin lezen zou toestaan.
    assert.equal(plain.headers.get("access-control-allow-origin"), null);
    assert.equal(withContext.headers.get("access-control-allow-origin"), null);
  } finally {
    server.close();
  }
});

test("4. gateway blijft publicatie en externe acties weigeren", async () => {
  const { adapter } = createMarkerAdapter();
  const store = createCapturingStore();
  const output = await runDraft(
    { reviewText: MARKER_REVIEW, isSynthetic: false },
    {
      adapter,
      storeFn: store.fn,
      contextMode: "demo",
      storeSecret: SECRET,
    },
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

function baseSettlement(): SettlementBase {
  return {
    receipt_id: `rcpt-${Math.random().toString(36).slice(2)}`,
    action_id: "act-1",
    argument_hash: "a".repeat(64),
    executed_at: new Date().toISOString(),
    capability: "draft.store",
    tool: "draft.store.local",
    workspace_id: "ws-motor",
    task_id: "task-1",
    run_id: "run-1",
    attempt_id: "att-1",
    policy_id: "policy-motor-default",
    policy_version: "1.1.0",
    policy_digest: "b".repeat(64),
    issued_at: new Date().toISOString(),
  };
}

function demoRecord(runId: string): DraftStoreRecord {
  return {
    stored_at: new Date().toISOString(),
    run_id: runId,
    receipt_id: "rcpt-x",
    synthetic: true,
    review: "demo-review",
    draft: "demo-concept",
  };
}

async function withStore(
  secret: string | undefined,
  fn: (base: string, dir: string) => Promise<void>,
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "pilot-store-"));
  const server = createStoreServer(join(dir, "drafts.jsonl"), { secret });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  try {
    await fn(`http://127.0.0.1:${address.port}`, dir);
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
}

async function postStore(
  base: string,
  body: unknown,
): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(`${base}/store`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

test("5a. store schrijft met geldig settlement; replay wordt geweigerd", async () => {
  await withStore(SECRET, async (base, dir) => {
    const record = demoRecord("run-1");
    const settlement = signSettlement(SECRET, baseSettlement(), record);

    const first = await postStore(base, { record, settlement });
    assert.equal(first.status, 200);
    assert.equal(first.json.ok, true);
    const written = await readFile(join(dir, "drafts.jsonl"), "utf8");
    assert.ok(written.includes('"run_id":"run-1"'));

    // Eenmalig: exact hetzelfde bewijs mag nooit twee keer schrijven.
    const replay = await postStore(base, { record, settlement });
    assert.equal(replay.status, 403);
    assert.equal(replay.json.error, "settlement_replayed");

    // Maar een NIEUWE run met toevallig dezelfde receipt_id (de gateway
    // nummert per instantie) en een ander record is géén replay: de
    // handtekening verschilt en de write slaagt.
    const record2 = demoRecord("run-1b");
    const collision = signSettlement(
      SECRET,
      { ...baseSettlement(), receipt_id: settlement.receipt_id },
      record2,
    );
    const second = await postStore(base, { record: record2, settlement: collision });
    assert.equal(second.status, 200);
  });
});

test("5b. store weigert ontbrekende, vervalste, gemuteerde en verlopen bewijzen", async () => {
  await withStore(SECRET, async (base, dir) => {
    const record = demoRecord("run-2");

    // Zonder settlement → 403 en géén bestand.
    const missing = await postStore(base, { record });
    assert.equal(missing.status, 403);
    assert.equal(missing.json.error, "settlement_required");

    // Verkeerd secret → bad_signature.
    const wrongSecret = signSettlement("fout-secret", baseSettlement(), record);
    const forged = await postStore(base, { record, settlement: wrongSecret });
    assert.equal(forged.status, 403);
    assert.equal(forged.json.error, "bad_signature");

    // Geldige handtekening op record A, maar record B opgestuurd → mismatch.
    const settlement = signSettlement(SECRET, baseSettlement(), record);
    const tampered = { ...record, draft: "gemanipuleerd" };
    const mismatch = await postStore(base, { record: tampered, settlement });
    assert.equal(mismatch.status, 403);
    assert.equal(mismatch.json.error, "record_mismatch");

    // Verlopen bewijs (60 s TTL) → settlement_expired.
    const expired = signSettlement(
      SECRET,
      baseSettlement(),
      record,
      Date.now() - 120_000,
    );
    const stale = await postStore(base, { record, settlement: expired });
    assert.equal(stale.status, 403);
    assert.equal(stale.json.error, "settlement_expired");

    // Niets van dit alles heeft ooit iets geschreven.
    await assert.rejects(readFile(join(dir, "drafts.jsonl"), "utf8"));
  });
});

test("5c. store is fail-closed zonder geconfigureerd secret", async () => {
  await withStore(undefined, async (base, dir) => {
    const record = demoRecord("run-3");
    const settlement = signSettlement(SECRET, baseSettlement(), record);
    const res = await postStore(base, { record, settlement });
    assert.equal(res.status, 503);
    assert.equal(res.json.error, "store_not_configured");
    await assert.rejects(readFile(join(dir, "drafts.jsonl"), "utf8"));
  });
});

test("5d. runDraft slaat expliciet niet op zonder store-secret", async () => {
  const { adapter } = createMarkerAdapter();
  const store = createCapturingStore();
  const output = await runDraft(
    { reviewText: MARKER_REVIEW, isSynthetic: true },
    {
      adapter,
      storeFn: store.fn,
      contextMode: "demo",
      storeSecret: "",
    },
  );
  assert.equal(output.store.decision, "ALLOW");
  if (output.store.decision === "ALLOW") {
    assert.equal(output.store.stored, false);
    assert.equal(output.store.error, "store_secret_not_configured");
  }
  // De store is nooit aangeroepen met een onondertekend bewijs.
  assert.equal(store.calls.length, 0);
});

test("6a. beslissing over onbekend concept wordt geweigerd", async () => {
  const out = await runDecision(
    { draftRunId: "run-bestaat-niet", decision: "approved" },
    {
      listDraftsImpl: async () => [],
      listDecisionsImpl: async () => [],
      storeSecret: SECRET,
    },
  );
  assert.equal(out.ok, false);
  assert.equal(out.error, "draft_not_found");
});

test("6b. beslissing landt via getekend settlement in decisions.jsonl; notitie nooit in evidence", async () => {
  await withStore(SECRET, async (base, dir) => {
    const storeFn = (record: Parameters<typeof storeDraftViaService>[0], settlement: Parameters<typeof storeDraftViaService>[1]) =>
      storeDraftViaService(record, settlement, base);
    const draftsPath = join(dir, "drafts.jsonl");
    const decisionsPath = join(dir, "decisions.jsonl");

    // Eerst een echt concept via de draft-flow.
    const { adapter } = createMarkerAdapter();
    const draftOut = await runDraft(
      { reviewText: MARKER_REVIEW, isSynthetic: false },
      {
        adapter,
        storeFn,
        contextMode: "demo",
        storeSecret: SECRET,
      },
    );
    assert.equal(draftOut.ok, true);
    const drafts = await listDrafts(20, draftsPath);
    assert.equal(drafts.length, 1);
    const runId = drafts[0].run_id;

    // Dan de menselijke beslissing via koppeling 2.
    const NOTE = "MARKER-NOTITIE-prive-99";
    const decision = await runDecision(
      { draftRunId: runId, decision: "approved", note: NOTE },
      {
        storeFn,
        storeSecret: SECRET,
        listDraftsImpl: (limit?: number) => listDrafts(limit ?? 500, draftsPath),
        listDecisionsImpl: (limit?: number) => listDecisions(limit ?? 1000, decisionsPath),
      },
    );
    if (!decision.ok) assert.fail(`decision faalde: ${decision.error}`);
    assert.equal(decision.stored, true);
    assert.equal(decision.chainValid, true);
    assert.equal(decision.orphans, 0);

    // De beslissing staat in decisions.jsonl, NIET in drafts.jsonl.
    const decisionsRaw = await readFile(decisionsPath, "utf8");
    assert.ok(decisionsRaw.includes(`"draft_run_id":"${runId}"`));
    assert.ok(decisionsRaw.includes('"decision":"approved"'));
    const draftsRaw = await readFile(draftsPath, "utf8");
    assert.ok(!draftsRaw.includes('"type":"decision"'));

    // De notitie leeft in het privé-volume maar nooit in evidence.
    assert.ok(decisionsRaw.includes(NOTE));
    assert.ok(!JSON.stringify(decision.evidence).includes(NOTE));

    // First-decision-wins: een tweede beslissing over hetzelfde concept
    // wordt geweigerd (append-only, geen herschrijven).
    const second = await runDecision(
      { draftRunId: runId, decision: "rejected" },
      {
        storeFn,
        storeSecret: SECRET,
        listDraftsImpl: (limit?: number) => listDrafts(limit ?? 500, draftsPath),
        listDecisionsImpl: (limit?: number) => listDecisions(limit ?? 1000, decisionsPath),
      },
    );
    assert.equal(second.ok, false);
    assert.equal(second.error, "already_decided");
  });
});

test("6c. store weigert onbekende record-types", async () => {
  await withStore(SECRET, async (base) => {
    const record = { type: "exploit", payload: "x" };
    const settlement = signSettlement(SECRET, baseSettlement(), record);
    const res = await postStore(base, { record, settlement });
    assert.equal(res.status, 400);
    assert.equal(res.json.error, "invalid_record_type");
  });
});

test("7a. ongeldige CONTEXT_MODE faalt gesloten; ontbrekend is gedocumenteerde demo", () => {
  assert.equal(contextModeFromEnv(undefined), "demo");
  assert.equal(contextModeFromEnv(""), "demo");
  assert.equal(contextModeFromEnv("  "), "demo");
  assert.equal(contextModeFromEnv("demo"), "demo");
  assert.equal(contextModeFromEnv("private"), "private");
  // Een typo of vreemde waarde mag NOOIT stil demo worden.
  assert.throws(() => contextModeFromEnv("privaat"), /context_mode_invalid/);
  assert.throws(() => contextModeFromEnv("DEMO"), /context_mode_invalid/);
  assert.throws(() => contextModeFromEnv("production"), /context_mode_invalid/);
});

test("7b. ieder getekend veld afzonderlijk getamperd → DENY", async () => {
  await withStore(SECRET, async (base) => {
    const record = demoRecord("run-tamper");
    const good = signSettlement(SECRET, baseSettlement(), record);

    const tamper = async (
      mutate: (s: ReturnType<typeof signSettlement>) => Record<string, unknown>,
      expected: string,
    ) => {
      const mutated = { ...good, ...mutate(good) };
      const res = await postStore(base, { record, settlement: mutated });
      assert.equal(res.status, 403);
      assert.equal(res.json.error, expected);
    };

    await tamper(() => ({ v: "v1" }), "unsupported_version");
    await tamper((s) => ({ capability: "review.reply.publish" }), "bad_signature");
    await tamper((s) => ({ tool: "other.tool" }), "bad_signature");
    await tamper((s) => ({ workspace_id: "ws-anders" }), "bad_signature");
    await tamper((s) => ({ task_id: "task-2" }), "bad_signature");
    await tamper((s) => ({ run_id: "run-2" }), "bad_signature");
    await tamper((s) => ({ attempt_id: "att-2" }), "bad_signature");
    await tamper((s) => ({ policy_digest: "c".repeat(64) }), "bad_signature");
    await tamper((s) => ({ policy_version: "9.9.9" }), "bad_signature");
    await tamper((s) => ({ nonce: "andere-nonce" }), "bad_signature");
    await tamper((s) => ({ issued_at: new Date().toISOString() }), "bad_signature");
    await tamper((s) => ({ executed_at: new Date().toISOString() }), "bad_signature");
    await tamper(() => ({ record_sha256: "d".repeat(64) }), "record_mismatch");

    // En de onaangeroerde controle: het origineel werkt gewoon.
    const ok = await postStore(base, { record, settlement: good });
    assert.equal(ok.status, 200);
  });
});

test("7c. twintig gelijktijdige identieke settlements → exact één write", async () => {
  await withStore(SECRET, async (base, dir) => {
    const record = demoRecord("run-race");
    const settlement = signSettlement(SECRET, baseSettlement(), record);
    const results = await Promise.all(
      Array.from({ length: 20 }, () => postStore(base, { record, settlement })),
    );
    const oks = results.filter((r) => r.status === 200);
    const replays = results.filter(
      (r) => r.status === 403 && r.json.error === "settlement_replayed",
    );
    assert.equal(oks.length, 1, "precies één write mag slagen");
    assert.equal(replays.length, 19);
    const written = await readFile(join(dir, "drafts.jsonl"), "utf8");
    assert.equal(written.trim().split("\n").length, 1);
  });
});

test("7d. crash na claim vóór append: write verloren, nooit dubbel (at-most-once)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pilot-store-"));
  let failOnce = true;
  const server = createStoreServer(join(dir, "drafts.jsonl"), {
    secret: SECRET,
    beforeAppend: async () => {
      if (failOnce) {
        failOnce = false;
        throw new Error("injected crash");
      }
    },
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const record = demoRecord("run-crash");
    const settlement = signSettlement(SECRET, baseSettlement(), record);
    // Eerste poging: crash ná de claim, vóór de append.
    const crashed = await postStore(base, { record, settlement });
    assert.equal(crashed.status, 500);
    // Retry met HETZELFDE bewijs: de claim is gebrand → replayed.
    const retry = await postStore(base, { record, settlement });
    assert.equal(retry.status, 403);
    assert.equal(retry.json.error, "settlement_replayed");
    // En er is nooit iets geschreven — geen dubbele, geen halve write.
    await assert.rejects(readFile(join(dir, "drafts.jsonl"), "utf8"));
  } finally {
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("7e. twee gelijktijdige beslissingen op hetzelfde concept → exact één record", async () => {
  await withStore(SECRET, async (base, dir) => {
    const storeFn = (record: StoreRecord, settlement: StoreSettlementProof) =>
      storeDraftViaService(record, settlement, base);
    const draftsPath = join(dir, "drafts.jsonl");
    const decisionsPath = join(dir, "decisions.jsonl");

    const { adapter } = createMarkerAdapter();
    const draftOut = await runDraft(
      { reviewText: MARKER_REVIEW, isSynthetic: false },
      { adapter, storeFn, contextMode: "demo", storeSecret: SECRET },
    );
    assert.equal(draftOut.ok, true);
    const drafts = await listDrafts(20, draftsPath);
    const runId = drafts[0].run_id;

    const deps = {
      storeFn,
      storeSecret: SECRET,
      listDraftsImpl: (limit?: number) => listDrafts(limit ?? 500, draftsPath),
      listDecisionsImpl: (limit?: number) => listDecisions(limit ?? 1000, decisionsPath),
    };
    const [a, b] = await Promise.all([
      runDecision({ draftRunId: runId, decision: "approved" }, deps),
      runDecision({ draftRunId: runId, decision: "rejected" }, deps),
    ]);
    const oks = [a, b].filter((x) => x.ok);
    const dupes = [a, b].filter((x) => !x.ok && x.error === "already_decided");
    assert.equal(oks.length, 1, "precies één beslissing mag landen");
    assert.equal(dupes.length, 1);
    const raw = await readFile(decisionsPath, "utf8");
    assert.equal(raw.trim().split("\n").length, 1);
  });
});

test("7f. approved maakt publish/mail/payment/device-control nooit toegestaan", () => {
  const ws = branded<WorkspaceId>("ws-motor");
  const gateway = createGateway(buildPilotPolicy(ws));
  const now = isoTimestamp(new Date().toISOString());
  for (const [capability, tool] of [
    ["review.reply.publish", "review.publish"],
    ["mail.send", "mail"],
    ["payment.create", "payments"],
    ["device.control", "device"],
  ] as const) {
    const req: ActionRequest = deepFreeze({
      schema_version: ADR110_SCHEMA_VERSION,
      action_id: branded(`act-probe-${capability}`),
      workspace_id: ws,
      task_id: branded<TaskId>("task-1"),
      run_id: branded<RunId>("run-1"),
      attempt_id: branded<AttemptId>("att-1"),
      capability,
      tool,
      args: {},
      data_class: "public",
      estimated_cost_cents: 0,
      requested_by: branded<EmployeeId>("employee-owner-operator"),
      requested_at: now,
    });
    // Zelfs mét een beslissing elders blijft dit gesloten: geen receipt,
    // geen approval → nooit ALLOW.
    const evaluation = gateway.evaluate(req, now);
    assert.notEqual(evaluation.decision, "ALLOW", `${capability} mag nooit ALLOW zijn`);
    const exec = gateway.executeAction(req, null, now);
    assert.equal(exec.executed, false);
  }
});

test("7g. mountmatrix: store ziet nooit context, API/CLI lezen hooguit ro", async () => {
  const url = new URL("../infra/pilot/compose.yaml", import.meta.url);
  const compose = await readFile(url, "utf8");
  const section = (rawName: string) => {
    const name = rawName.replace(/:$/, "");
    // Anker op regelbegin: "  motor-pilot-store:" komt ook voor als
    // depends_on-verwijzing (met 6 spaties inspringing) — een losse
    // indexOf zou die ten onrechte matchen.
    const start = compose.search(new RegExp(`^  ${name}:\\n`, "m"));
    assert.ok(start >= 0, `service ${name} ontbreekt`);
    const rest = compose.slice(start + name.length + 3);
    const next = rest.search(/^  \S/m);
    const block = next === -1 ? rest : rest.slice(0, next);
    // Commentaarregels doen niet mee: een comment dat een volume NOEMT
    // ("mount NOOIT pilot-context") is geen mount.
    return block
      .split("\n")
      .map((line) => line.replace(/#.*$/, ""))
      .join("\n");
  };
  const store = section("motor-pilot-store");
  assert.ok(store.includes("pilot-drafts:/data\n"), "store schrijft drafts rw");
  assert.ok(!store.includes("pilot-context"), "store mount NOOIT context");
  const api = section("motor-pilot-api");
  assert.ok(api.includes("pilot-drafts:/data:ro"), "API leest drafts ro");
  assert.ok(api.includes("pilot-context:/context:ro"), "API leest context ro");
  const cli = section("motor-pilot:");
  assert.ok(cli.includes("pilot-context:/context:ro"), "CLI mount context ro (expliciete topologie)");
  assert.ok(!cli.includes("pilot-drafts"), "CLI mount de draftstore niet");
  for (const svc of ["motor-pilot-store", "motor-pilot-api", "motor-pilot:"]) {
    const block = section(svc);
    assert.ok(block.includes("cap_drop"), `${svc} zonder cap_drop`);
    assert.ok(block.includes("no-new-privileges"), `${svc} zonder no-new-privileges`);
  }
});

test("6d. HTTP: /decision afdwingen van identiteit en content-type", async () => {
  const denied = createPilotServer({
    acl: parseAcl('{"nPIETJE123CNTRL":["ws-motor"]}'),
    resolveNode: async () => null,
  });
  await new Promise<void>((resolve) => denied.listen(0, "127.0.0.1", resolve));
  const deniedAddr = denied.address();
  assert.ok(deniedAddr !== null && typeof deniedAddr === "object");
  try {
    const res = await fetch(`http://127.0.0.1:${deniedAddr.port}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draft_run_id: "run-x", decision: "approved" }),
    });
    assert.equal(res.status, 403);
  } finally {
    denied.close();
  }

  const server = createPilotServer({
    acl: parseAcl('{"nPIETJE123CNTRL":["ws-motor"]}'),
    resolveNode: async () => ({ stableId: "nPIETJE123CNTRL", name: "pietje" }),
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  try {
    const plain = await fetch(`http://127.0.0.1:${address.port}/decision`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "draft_run_id=run-x",
    });
    assert.equal(plain.status, 415);

    const badDecision = await fetch(`http://127.0.0.1:${address.port}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ draft_run_id: "run-x", decision: "misschien" }),
    });
    assert.equal(badDecision.status, 400);
  } finally {
    server.close();
  }
});
