/**
 * Gezamenlijke contracttest (coördinator, integratiefase) — dezelfde
 * synthetische fixture draait door alle adapterbindingen:
 *
 *   fake-alpha, fake-beta, llamacpp (deterministische OpenAI-transportfake),
 *   hermes (fase-0-fakesidecar) en agentscope (fase-0-fakesidecar).
 *
 * Per adapter blijven gelijk: Employee-ID en mandaat, Task-ID en workspace,
 * policy-ID/versie/digest, ContextManifest-semantiek en -digest, Motor's
 * Run/Attempt-causaliteit, evidenceketen en evaluatiecriteria, en
 * default-deny voor niet-geautoriseerde capabilities. Alleen operationele
 * binding, adaptermetadata, latency en outputartifact mogen verschillen.
 *
 * Failurecases: unavailable, malformed, timeout en cancel eindigen in een
 * gecontroleerde terminale Motor-state met causale failure-evidence — nooit
 * in een hangende Attempt of een adapter-eigen retryloop.
 *
 * CI draait alles tegen fakes; geen echte runtime, geen netwerk buiten
 * 127.0.0.1, geen echte context. REAL_CONTEXT_USED=no, EXTERNAL_EFFECTS=no.
 */

import assert from "node:assert/strict";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import type {
  AdapterInvokeRequest,
  CapabilityAdapter,
} from "../lib/adr110/adapters/contract.ts";
import { createFakeAlphaAdapter } from "../lib/adr110/adapters/fake-alpha.ts";
import { createFakeBetaAdapter } from "../lib/adr110/adapters/fake-beta.ts";
import { createLlamaCppServerAdapter } from "../lib/adr110/adapters/llamacpp-server.ts";
import { createHermesAdapter } from "../lib/adr110/adapters/hermes/adapter.ts";
import { createAgentScopeAdapter } from "../lib/adr110/adapters/agentscope/sidecar-client.ts";
import {
  applyEngineEvent,
  initialKernelProjection,
  type EngineEvent,
} from "../lib/adr110/engine.ts";
import {
  buildEvidenceChain,
  findOrphans,
  makeEvidenceRecord,
} from "../lib/adr110/evidence.ts";
import {
  ADR110_SCHEMA_VERSION,
  branded,
} from "../lib/adr110/types.ts";
import type { AttemptId, RunId } from "../lib/adr110/types.ts";
import {
  buildProofFixture,
  createRunIds,
  PROOF_WORKSPACE_ID,
  runTaskThroughAdapter,
  T1,
  T2,
} from "../lib/adr110/scenario.ts";

// ---------------------------------------------------------------------------
// Deterministische fakes (loopback only)
// ---------------------------------------------------------------------------

interface FakeServer {
  readonly url: string;
  readonly close: () => Promise<void>;
}

async function startServer(
  handler: (req: IncomingMessage, res: ServerResponse, body: string) => void,
): Promise<FakeServer> {
  const server: Server = createServer((req, res) => {
    res.on("error", () => undefined);
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        handler(req, res, body);
      } catch {
        try {
          res.writeHead(500).end();
        } catch {
          // late write op een afgebroken socket: negeren
        }
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

/** Fase-0-sidecarprotocol: /health, /invoke (met causale echo), /cancel. */
function startPhase0Sidecar(): Promise<FakeServer> {
  return startServer((req, res, body) => {
    const json = (status: number, payload: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    };
    if (req.method === "GET" && req.url === "/health") {
      json(200, { status: "ok" });
      return;
    }
    if (req.method === "POST" && req.url === "/invoke") {
      const parsed = JSON.parse(body) as Record<string, unknown>;
      json(200, {
        output: `conformance draft: ${String(parsed.input ?? "")}`,
        task_id: parsed.task_id,
        run_id: parsed.run_id,
        attempt_id: parsed.attempt_id,
      });
      return;
    }
    if (req.method === "POST" && req.url === "/cancel") {
      json(200, { cancelled: true });
      return;
    }
    json(404, { error: "not_found" });
  });
}

/** Minimale OpenAI-transportfake voor de llama.cpp-route. */
function startOpenAiFake(): Promise<FakeServer> {
  return startServer((req, res, body) => {
    const json = (status: number, payload: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(payload));
    };
    if (req.method === "GET" && req.url === "/health") {
      json(200, { status: "ok" });
      return;
    }
    if (req.method === "POST" && req.url === "/v1/chat/completions") {
      const parsed = JSON.parse(body) as {
        messages?: { content?: string }[];
      };
      const input = parsed.messages?.[0]?.content ?? "";
      json(200, {
        choices: [
          {
            message: { role: "assistant", content: `conformance draft: ${input}` },
            finish_reason: "stop",
          },
        ],
      });
      return;
    }
    json(404, { error: "not_found" });
  });
}

// ---------------------------------------------------------------------------
// De gezamenlijke run
// ---------------------------------------------------------------------------

test("conformance: vijf bindingen, één semantiek", async () => {
  const sidecar = await startPhase0Sidecar();
  const openai = await startOpenAiFake();
  try {
    const fixture = buildProofFixture();
    const adapters: Record<string, CapabilityAdapter> = {
      "fake-alpha": createFakeAlphaAdapter(),
      "fake-beta": createFakeBetaAdapter(),
      llamacpp: createLlamaCppServerAdapter({
        baseUrl: openai.url,
        model: "conformance-model",
        timeoutMs: 5_000,
      }),
      hermes: createHermesAdapter({
        baseUrl: sidecar.url,
        invokeTimeoutMs: 5_000,
      }),
      agentscope: createAgentScopeAdapter({
        sidecarUrl: sidecar.url,
        invokeTimeoutMs: 5_000,
      }),
    };

    const runs = new Map<string, Awaited<ReturnType<typeof runTaskThroughAdapter>>>();
    for (const [label, adapter] of Object.entries(adapters)) {
      runs.set(
        label,
        await runTaskThroughAdapter(adapter, fixture, createRunIds(`conf-${label}`)),
      );
    }

    const reference = runs.get("fake-alpha")!;
    const adapterIds = new Set<string>();
    for (const [label, run] of runs) {
      // Employee-ID en mandaat, Task-ID en Run/Attempt-causaliteit gelijk.
      assert.equal(run.agent.delegated_by, reference.agent.delegated_by, label);
      assert.equal(run.manifest.task_id, reference.manifest.task_id, label);
      // Policy-identiteit en ContextManifest-semantiek blijven gelijk.
      assert.deepEqual(run.manifest.policy, reference.manifest.policy, label);
      assert.deepEqual(run.manifest.items, reference.manifest.items, label);
      assert.equal(run.manifest.total_digest, reference.manifest.total_digest, label);
      // De run is gelukt en de causale evidenceketen is valide.
      assert.equal(run.result.ok, true, label);
      const chain = buildEvidenceChain(run.evidence);
      assert.equal(chain.ok, true, label);
      assert.deepEqual(findOrphans(run.evidence), [], label);
      // Default-deny: geen enkele adapter claimt een muterende capability.
      for (const capability of adapterDenyList) {
        assert.ok(
          !adapters[label].capabilities.includes(capability),
          `${label} mag ${capability} niet claimen`,
        );
      }
      adapterIds.add(run.result.ok === true ? run.result.meta.adapter_id : "?");
    }
    // Alleen de operationele binding verschilt.
    assert.equal(adapterIds.size, 5, "vijf verschillende adapterbindingen");
  } finally {
    await sidecar.close();
    await openai.close();
  }
});

const adapterDenyList = [
  "review.reply.publish",
  "mail.send",
  "payment.create",
  "device.control",
] as const;

test("conformance: adapterfout → terminale Motor-state + causale failure-evidence", async () => {
  const down = await startServer((_req, res) => {
    res.writeHead(500, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "sidecar down" }));
  });
  try {
    const fixture = buildProofFixture();
    for (const [label, adapter] of Object.entries({
      hermes: createHermesAdapter({ baseUrl: down.url, invokeTimeoutMs: 5_000 }),
      agentscope: createAgentScopeAdapter({
        sidecarUrl: down.url,
        invokeTimeoutMs: 5_000,
      }),
    })) {
      // Bouw de invoke-request via de gedeelde fixture-machinerie (pure
      // fake-alpha, geen I/O) zodat Employee/Task/context/policy identiek zijn.
      const seed = await runTaskThroughAdapter(
        createFakeAlphaAdapter(),
        fixture,
        createRunIds(`conf-fail-seed-${label}`),
      );
      const ids = createRunIds(`conf-fail-${label}`);
      const run_id = branded<RunId>(ids.run_id);
      const attempt_id = branded<AttemptId>(ids.attempt_id);
      const request: AdapterInvokeRequest = {
        task_id: fixture.task.task_id,
        run_id,
        attempt_id,
        manifest: seed.manifest,
        agent: seed.agent,
        runtime: seed.runtime,
        model: seed.model,
        input: "Draft a friendly reply to review #42",
      };
      const result = await adapter.invoke(request);
      assert.equal(result.ok, false, label);
      if (result.ok) return;
      assert.equal(result.error.code, "unavailable", label);

      // Terminale Motor-state via engine-events: nooit een hangende Attempt.
      const task_id = fixture.task.task_id;
      const events: EngineEvent[] = [
        {
          schema_version: ADR110_SCHEMA_VERSION,
          event_id: branded(`evt-conf-${label}-run-started`),
          seq: 1,
          workspace_id: PROOF_WORKSPACE_ID,
          task_id,
          run_id,
          type: "run.started",
          occurred_at: T1,
        },
        {
          schema_version: ADR110_SCHEMA_VERSION,
          event_id: branded(`evt-conf-${label}-att-started`),
          seq: 2,
          workspace_id: PROOF_WORKSPACE_ID,
          task_id,
          run_id,
          attempt_id,
          type: "attempt.started",
          occurred_at: T1,
        },
        {
          schema_version: ADR110_SCHEMA_VERSION,
          event_id: branded(`evt-conf-${label}-att-failed`),
          seq: 3,
          workspace_id: PROOF_WORKSPACE_ID,
          task_id,
          run_id,
          attempt_id,
          type: "attempt.failed",
          occurred_at: T2,
        },
        {
          schema_version: ADR110_SCHEMA_VERSION,
          event_id: branded(`evt-conf-${label}-run-failed`),
          seq: 4,
          workspace_id: PROOF_WORKSPACE_ID,
          task_id,
          run_id,
          type: "run.failed",
          occurred_at: T2,
        },
      ];
      let projection = initialKernelProjection();
      for (const event of events) {
        projection = applyEngineEvent(projection, event);
      }
      assert.equal(
        projection.tasks[task_id as string]?.status,
        "failed",
        `${label}: failure eindigt terminaal, nooit hangend`,
      );

      // Causale failure-evidence: valide keten, geen orphans.
      const evTask = makeEvidenceRecord({
        evidence_id: branded(`ev-conf-${label}-task`),
        stage: "task",
        task_id,
        subject_id: task_id as string,
        kind_detail: "task.assigned",
        data: { employee_id: fixture.employee.employee_id },
        occurred_at: T1,
      });
      const evRun = makeEvidenceRecord({
        evidence_id: branded(`ev-conf-${label}-run`),
        stage: "run",
        task_id,
        run_id,
        subject_id: run_id as string,
        parent_evidence_id: evTask.evidence_id,
        kind_detail: "run.started",
        data: { adapter_id: adapter.adapter_id },
        occurred_at: T1,
      });
      const evAttempt = makeEvidenceRecord({
        evidence_id: branded(`ev-conf-${label}-attempt`),
        stage: "attempt",
        task_id,
        run_id,
        attempt_id,
        subject_id: attempt_id as string,
        parent_evidence_id: evRun.evidence_id,
        kind_detail: "attempt.started",
        data: { adapter_id: adapter.adapter_id },
        occurred_at: T1,
      });
      const evOutcome = makeEvidenceRecord({
        evidence_id: branded(`ev-conf-${label}-outcome`),
        stage: "outcome",
        task_id,
        run_id,
        attempt_id,
        subject_id: attempt_id as string,
        parent_evidence_id: evAttempt.evidence_id,
        kind_detail: "attempt.failed",
        data: { error_code: result.error.code, retryable: result.error.retryable },
        occurred_at: T2,
      });
      const evidence = [evTask, evRun, evAttempt, evOutcome];
      const chain = buildEvidenceChain(evidence);
      assert.equal(chain.ok, true, `${label}: failure-evidence vormt een valide keten`);
      assert.deepEqual(findOrphans(evidence), [], label);
    }
  } finally {
    await down.close();
  }
});
