/**
 * Security-track P0.6 — failurepad-evidence en post-run actiegrens
 * (aanvalspunten 6 en 8).
 *
 *  - S6: een falende/timeoutende adapter mag nooit een hangende of
 *    evidence-loze run achterlaten: de pilot-flow eindigt altijd in een
 *    terminale Motor-state mét valide causale failure-evidence, en er wordt
 *    nooit iets opgeslagen. (De adapter-niveau failurematrix staat in
 *    conformance.test.ts; hier hetzelfde verhaal op volledige-flow-niveau.)
 *  - S8: publish/mail/payment/device-control ná een échte geslaagde
 *    synthetische run én een échte "approved"-beslissing → nog steeds DENY.
 *    Bouwt voort op boundary-test 7f, maar dan met echte causale id's, een
 *    écht opgeslagen concept, een écht gemint store-receipt en een écht
 *    gedecideerd concept als aanvalsmateriaal.
 *
 * Alles synthetisch; markers in plaats van bedrijfsinhoud.
 */
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  ADR110_SCHEMA_VERSION,
  branded,
  createGateway,
  deepFreeze,
  isoTimestamp,
} from "../../lib/adr110/index.ts";
import type {
  ActionRequest,
  AttemptId,
  EmployeeId,
  GatewayReceipt,
  IsoTimestamp,
  RunId,
  TaskId,
  WorkspaceId,
} from "../../lib/adr110/index.ts";
import type {
  AdapterInvokeRequest,
  AdapterResult,
  CapabilityAdapter,
} from "../../lib/adr110/adapters/contract.ts";
import { buildPilotPolicy, runDraft } from "../draft-core.ts";
import { runDecision } from "../decision-core.ts";
import type {
  DecisionStoreRecord,
  DraftStoreRecord,
  StoreRecord,
  StoreResult,
  StoreSettlementProof,
} from "../draft-store.ts";

const MARKER_DRAFT = "MARKER-DRAFT-s8-synthetisch";
const SECRET = "fedcba9876543210".repeat(4);

function createMarkerAdapter(): CapabilityAdapter {
  return deepFreeze({
    adapter_id: "fake-marker-s8",
    adapter_version: "0.0.1",
    capabilities: ["draft.generate"],
    requirements: { data_classes: ["public", "internal"], network: "none" },
    health(now: IsoTimestamp) {
      return {
        adapter_id: "fake-marker-s8",
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
          adapter_id: "fake-marker-s8",
          adapter_version: "0.0.1",
          simulated_latency_ms: 1,
          simulated_cost_cents: 0,
          task_id: request.task_id,
          run_id: request.run_id,
          attempt_id: request.attempt_id,
        },
      };
    },
    cancel(attempt_id: AttemptId) {
      return { cancelled: true, attempt_id };
    },
  });
}

/** Adapter die altijd faalt met de opgegeven fase-0-foutcode. */
function createFailingAdapter(code: string, retryable: boolean): CapabilityAdapter {
  return deepFreeze({
    adapter_id: "fake-fail-s6",
    adapter_version: "0.0.1",
    capabilities: ["draft.generate"],
    requirements: { data_classes: ["public", "internal"], network: "none" },
    health(now: IsoTimestamp) {
      return {
        adapter_id: "fake-fail-s6",
        adapter_version: "0.0.1",
        status: "down" as const,
        checked_at: now,
      };
    },
    invoke(request: AdapterInvokeRequest): AdapterResult {
      return {
        ok: false,
        error: {
          code,
          message: `gesimuleerde fout: ${code}`,
          retryable,
          task_id: request.task_id,
          run_id: request.run_id,
          attempt_id: request.attempt_id,
        },
      };
    },
    cancel(attempt_id: AttemptId) {
      return { cancelled: true, attempt_id };
    },
  });
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

function dangerousRequest(
  ids: { workspace_id: WorkspaceId; task_id: TaskId; run_id: RunId; attempt_id: AttemptId },
  capability: string,
  tool: string,
  now: IsoTimestamp,
): ActionRequest {
  return deepFreeze({
    schema_version: ADR110_SCHEMA_VERSION,
    action_id: branded(`act-s8-${capability}`),
    workspace_id: ids.workspace_id,
    task_id: ids.task_id,
    run_id: ids.run_id,
    attempt_id: ids.attempt_id,
    capability,
    tool,
    args: { draft: MARKER_DRAFT },
    // "internal": toegestaan door élke policy-capability, zodat een DENY hier
    // nooit aan de dataklasse maar altijd aan de capability zelf ligt.
    data_class: "internal",
    estimated_cost_cents: 0,
    requested_by: branded<EmployeeId>("employee-owner-operator"),
    requested_at: now,
  });
}

test("S6a. timeout/adapterfout op flow-niveau → terminale state + valide failure-evidence, nooit een write", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pilot-s6-"));
  try {
    const contextFile = join(dir, "context.txt");
    await writeFile(contextFile, "synthetische context", "utf8");
    for (const [code, retryable] of [
      ["timeout", true],
      ["unavailable", true],
      ["malformed_response", false],
    ] as const) {
      const store = createCapturingStore();
      const output = await runDraft(
        { reviewText: "synthetische review", isSynthetic: true },
        {
          adapter: createFailingAdapter(code, retryable),
          storeFn: store.fn,
          contextMode: "private",
          contextFile,
          storeSecret: SECRET,
        },
      );
      assert.equal(output.ok, false, code);
      assert.equal(output.draft, null, code);
      // Terminale Motor-state: de run hangt nooit.
      assert.equal(output.kernelTaskStatus, "failed", code);
      // Terminale evidence: outcome met status failure, keten valide.
      const outcome = output.evidence.find((e) => e.stage === "outcome");
      assert.ok(outcome, `${code}: outcome-evidence ontbreekt`);
      assert.deepEqual(
        (outcome.data as { status?: string }).status,
        "failure",
        code,
      );
      const artifact = output.evidence.find((e) => e.kind_detail === "adapter.result");
      assert.ok(artifact, `${code}: artifact-evidence ontbreekt`);
      assert.equal(
        (artifact.data as { error?: { code?: string } }).error?.code,
        code,
        `${code}: de foutcode moet als evidence vastliggen`,
      );
      assert.equal(output.chainValid, true, code);
      assert.equal(output.orphans, 0, code);
      // Een gefaalde run schrijft nooit iets weg.
      assert.equal(output.store.stored, false, code);
      assert.equal(store.calls.length, 0, code);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("S6b. cancel na een gefaalde attempt blijft een terminaal antwoord (geen hang, geen throw)", async () => {
  const adapter = createFailingAdapter("timeout", true);
  const dir = await mkdtemp(join(tmpdir(), "pilot-s6c-"));
  try {
    const contextFile = join(dir, "context.txt");
    await writeFile(contextFile, "synthetische context", "utf8");
    const output = await runDraft(
      { reviewText: "synthetische review", isSynthetic: true },
      {
        adapter,
        storeFn: createCapturingStore().fn,
        contextMode: "private",
        contextFile,
        storeSecret: SECRET,
      },
    );
    assert.equal(output.ok, false);
    const attempt = output.evidence.find((e) => e.stage === "attempt");
    assert.ok(attempt?.attempt_id, "attempt-id ontbreekt in evidence");
    const started = Date.now();
    const cancelled = await adapter.cancel(attempt.attempt_id, isoTimestamp(new Date().toISOString()));
    assert.ok(Date.now() - started < 1_000, "cancel mag nooit hangen");
    assert.equal(cancelled.cancelled, true);
    assert.equal(cancelled.attempt_id, attempt.attempt_id);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("S8a. na een échte geslaagde run: publish/mail/payment/device-control blijven DENY", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pilot-s8-"));
  try {
    const contextFile = join(dir, "context.txt");
    await writeFile(contextFile, "synthetische context", "utf8");
    const store = createCapturingStore();
    const output = await runDraft(
      { reviewText: "synthetische review", isSynthetic: true },
      {
        adapter: createMarkerAdapter(),
        storeFn: store.fn,
        contextMode: "private",
        contextFile,
        storeSecret: SECRET,
      },
    );
    assert.equal(output.ok, true, "testopstelling: de run moet slagen");
    assert.equal(store.calls.length, 1, "testopstelling: concept opgeslagen");

    // Echte causale id's uit de geslaagde run.
    const attemptEvidence = output.evidence.find((e) => e.stage === "attempt");
    assert.ok(attemptEvidence, "testopstelling: attempt-evidence aanwezig");
    if (
      attemptEvidence.attempt_id === undefined ||
      attemptEvidence.run_id === undefined
    ) {
      assert.fail("testopstelling: causale id's aanwezig");
    }
    const ids = {
      workspace_id: branded<WorkspaceId>("ws-motor"),
      task_id: attemptEvidence.task_id,
      run_id: attemptEvidence.run_id,
      attempt_id: attemptEvidence.attempt_id,
    };
    const now = isoTimestamp(new Date().toISOString());
    const gateway = createGateway(buildPilotPolicy(ids.workspace_id));

    for (const [capability, tool] of [
      ["review.reply.publish", "review.publish"],
      ["mail.send", "mail"],
      ["payment.create", "payments"],
      ["device.control", "device"],
    ] as const) {
      const req = dangerousRequest(ids, capability, tool, now);
      const evaluation = gateway.evaluate(req, now);
      assert.notEqual(
        evaluation.decision,
        "ALLOW",
        `${capability} mag na een geslaagde run nooit ALLOW zijn`,
      );
      const minted = gateway.mintReceipt(req, now);
      assert.equal(minted.ok, false, `${capability} mag nooit een receipt minten`);
      const exec = gateway.executeAction(req, null, now);
      assert.equal(exec.executed, false, `${capability} mag nooit uitvoeren`);
    }
    // De ingebouwde deny-probe van de flow zelf bevestigt hetzelfde.
    assert.deepEqual(output.gateway.publishProbe, {
      executed: false,
      decision: "DENY",
      reason: "receipt_required",
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("S8b. een échte approved-beslissing is geen uitvoeringsmachtiging voor publish", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pilot-s8b-"));
  try {
    const contextFile = join(dir, "context.txt");
    await writeFile(contextFile, "synthetische context", "utf8");
    const draftStore = createCapturingStore();
    const runOutput = await runDraft(
      { reviewText: "synthetische review", isSynthetic: true },
      {
        adapter: createMarkerAdapter(),
        storeFn: draftStore.fn,
        contextMode: "private",
        contextFile,
        storeSecret: SECRET,
      },
    );
    assert.equal(runOutput.ok, true);
    const storedDraft = draftStore.calls[0]?.record as DraftStoreRecord;
    assert.ok(storedDraft?.run_id, "testopstelling: opgeslagen concept");

    // Echte "approved"-beslissing via de echte decision-flow.
    const decisionStore = createCapturingStore();
    const decision = await runDecision(
      { draftRunId: storedDraft.run_id, decision: "approved", note: "synthetisch akkoord" },
      {
        storeFn: decisionStore.fn,
        storeSecret: SECRET,
        listDraftsImpl: async () => [storedDraft],
        listDecisionsImpl: async () => [],
      },
    );
    assert.equal(decision.ok, true, "testopstelling: beslissing opgeslagen");
    const decisionRecord = decisionStore.calls[0]?.record as DecisionStoreRecord;
    assert.equal(decisionRecord.decision, "approved");

    // Aanval: gebruik het ECHTE beslissings-record (met échte receipt_id)
    // alsof het een gateway-receipt voor publish is.
    const attemptEvidence = runOutput.evidence.find((e) => e.stage === "attempt");
    assert.ok(attemptEvidence, "testopstelling: attempt-evidence aanwezig");
    if (
      attemptEvidence.attempt_id === undefined ||
      attemptEvidence.run_id === undefined
    ) {
      assert.fail("testopstelling: causale id's aanwezig");
    }
    const ids = {
      workspace_id: branded<WorkspaceId>("ws-motor"),
      task_id: attemptEvidence.task_id,
      run_id: attemptEvidence.run_id,
      attempt_id: attemptEvidence.attempt_id,
    };
    const now = isoTimestamp(new Date().toISOString());
    const gateway = createGateway(buildPilotPolicy(ids.workspace_id));
    const publishReq = dangerousRequest(ids, "review.reply.publish", "review.publish", now);

    const forgedReceipt = {
      receipt_id: decisionRecord.receipt_id,
      capability: "review.reply.publish",
      tool: "review.publish",
      argument_hash: "0".repeat(64),
      task_id: ids.task_id,
      run_id: ids.run_id,
      attempt_id: ids.attempt_id,
      minted_at: now,
      expires_at: isoTimestamp(new Date(Date.now() + 60_000).toISOString()),
    } as unknown as GatewayReceipt;
    const exec = gateway.executeAction(publishReq, forgedReceipt, now);
    assert.equal(exec.executed, false);
    if (exec.executed) return;
    assert.equal(
      exec.reason,
      "receipt_not_minted_by_this_gateway",
      "een beslissings-receipt mag nooit als publish-receipt gelden",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("S8c. echte receipts uit de flow zijn niet te recyclen tot een publish", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pilot-s8c-"));
  try {
    const contextFile = join(dir, "context.txt");
    await writeFile(contextFile, "synthetische context", "utf8");
    const output = await runDraft(
      { reviewText: "synthetische review", isSynthetic: true },
      {
        adapter: createMarkerAdapter(),
        storeFn: createCapturingStore().fn,
        contextMode: "private",
        contextFile,
        storeSecret: SECRET,
      },
    );
    assert.equal(output.ok, true);
    const attemptEvidence = output.evidence.find((e) => e.stage === "attempt");
    assert.ok(attemptEvidence, "testopstelling: attempt-evidence aanwezig");
    if (
      attemptEvidence.attempt_id === undefined ||
      attemptEvidence.run_id === undefined
    ) {
      assert.fail("testopstelling: causale id's aanwezig");
    }
    const ids = {
      workspace_id: branded<WorkspaceId>("ws-motor"),
      task_id: attemptEvidence.task_id,
      run_id: attemptEvidence.run_id,
      attempt_id: attemptEvidence.attempt_id,
    };
    const now = isoTimestamp(new Date().toISOString());
    const gateway = createGateway(buildPilotPolicy(ids.workspace_id));

    // Mint een ECHT receipt voor een R0-capability (zoals de flow dat doet).
    const storeReq = dangerousRequest(ids, "draft.store", "draft.store.local", now);
    const minted = gateway.mintReceipt(storeReq, now);
    assert.ok(minted.ok, "testopstelling: draft.store mintt zonder approval");
    if (!minted.ok) return;

    // Aanval 1: gebruik het echte store-receipt voor een publish-request.
    const publishReq = dangerousRequest(ids, "review.reply.publish", "review.publish", now);
    const crossUse = gateway.executeAction(publishReq, minted.receipt, now);
    assert.equal(crossUse.executed, false);
    if (!crossUse.executed) {
      assert.equal(crossUse.reason, "tool_mismatch");
    }

    // Aanval 2: gebruik hetzelfde receipt twee keer voor zijn eigen actie.
    const first = gateway.executeAction(storeReq, minted.receipt, now);
    assert.equal(first.executed, true, "testopstelling: eerste uitvoering slaagt");
    const replay = gateway.executeAction(storeReq, minted.receipt, now);
    assert.equal(replay.executed, false);
    if (!replay.executed) {
      assert.equal(replay.reason, "receipt_already_used");
    }

    // Aanval 3: zelfde receipt, stilletjes gewijzigde argumenten.
    const minted2 = gateway.mintReceipt(storeReq, now);
    assert.ok(minted2.ok);
    if (!minted2.ok) return;
    const mutatedReq = dangerousRequest(ids, "draft.store", "draft.store.local", now);
    const tampered: ActionRequest = { ...mutatedReq, args: { draft: "GEPONST" } };
    const swapped = gateway.executeAction(tampered, minted2.receipt, now);
    assert.equal(swapped.executed, false);
    if (!swapped.executed) {
      assert.equal(swapped.reason, "argument_hash_mismatch");
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
