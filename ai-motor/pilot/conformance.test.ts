/**
 * Gezamenlijke contracttest (coördinator, integratiefase; P0.6 lane D:
 * runtime-activatie) — dezelfde synthetische fixture draait door alle vijf
 * adapterbindingen:
 *
 *   fake-alpha, fake-beta, llamacpp (deterministische OpenAI-transportfake),
 *   hermes (het ECHTE sidecar-proces, python stdlib-only) en agentscope
 *   (het ECHTE sidecar-proces zodra `import agentscope` lukt, anders een
 *   expliciet geregistreerde terugval op de fase-0-fake).
 *
 * Per adapter blijven gelijk: Employee-ID en mandaat, Task-ID en workspace,
 * policy-ID/versie/digest, ContextManifest-semantiek en -digest, Motor's
 * Run/Attempt-causaliteit, evidenceketen en evaluatiecriteria, en
 * default-deny voor niet-geautoriseerde capabilities. Alleen operationele
 * binding, adaptermetadata, latency en outputartifact mogen verschillen.
 *
 * De echte sidecars draaien als python3-subproces op 127.0.0.1 met
 * MODEL_PORT_URL wijzend naar de OpenAI-fake in dit bestand — nooit naar
 * een echt model. Python ontbreekt (bv. de node:24-alpine CI-container):
 * de binding valt terug op de in-proces fase-0-fake en de modustest
 * hieronder registreert dat expliciet (SKIP met reden). Waar python3 wél
 * bestaat MOET hermes echt draaien; een startfout is een harde testfailure,
 * nooit een stille terugval. agentscope is een extra Python-dep: zonder
 * `import agentscope` is de fake-terugval toegestaan én vastgelegd.
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
  spawn,
  spawnSync,
  type ChildProcess,
} from "node:child_process";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
// Omgevingsdetectie (éénmalig, synchroon, fail-closed)
// ---------------------------------------------------------------------------

const AI_MOTOR_ROOT = fileURLToPath(new URL("..", import.meta.url));
const HERMES_SIDECAR_PY = join(
  AI_MOTOR_ROOT,
  "infra",
  "pilot",
  "hermes",
  "sidecar.py",
);
const AGENTSCOPE_SIDECAR_PY = join(
  AI_MOTOR_ROOT,
  "pilot",
  "adapters",
  "agentscope",
  "sidecar.py",
);

/** Waar is python3 nodig: de hermes-sidecar is stdlib-only en MOET echt
 *  draaien zodra een python3-interpreter bestaat; agentscope vereist
 *  daarnaast het gepinde agentscope-package (zie requirements-lock.txt). */
function probePython3(): { readonly ok: boolean; readonly detail: string } {
  const probe = spawnSync("python3", ["--version"], { encoding: "utf8" });
  if (probe.error || probe.status !== 0) {
    return {
      ok: false,
      detail: probe.error?.message ?? `exit ${String(probe.status)}`,
    };
  }
  return { ok: true, detail: (probe.stdout || probe.stderr).trim() };
}

function probeAgentScope(): { readonly ok: boolean; readonly detail: string } {
  const python = probePython3();
  if (!python.ok) {
    return { ok: false, detail: `python3 ontbreekt: ${python.detail}` };
  }
  const probe = spawnSync("python3", ["-c", "import agentscope"], {
    encoding: "utf8",
  });
  if (probe.error || probe.status !== 0) {
    const stderr = (probe.stderr ?? "").trim().split("\n").pop() ?? "";
    return { ok: false, detail: `import agentscope faalde: ${stderr}` };
  }
  return { ok: true, detail: "import agentscope OK" };
}

const PYTHON3 = probePython3();
const AGENTSCOPE_IMPORTABLE = probeAgentScope();

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

/** Fase-0-sidecarprotocol-fake: /health, /invoke (met causale echo),
 *  /cancel — de expliciete terugval waar geen python-runtime beschikbaar
 *  is (alleen agentscope, of beide bindingen zonder python3). */
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

/** Laatste user-message als tekst; hermes stuurt een kale string, agentscope
 *  (via de openai-client) een content-blocklijst — beide zijn toegestaan. */
function extractPrompt(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  for (const message of [...messages].reverse()) {
    if (
      typeof message !== "object" ||
      message === null ||
      (message as { role?: unknown }).role !== "user"
    ) {
      continue;
    }
    const content = (message as { content?: unknown }).content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((part: unknown) => {
          if (typeof part !== "object" || part === null) return "";
          const block = part as { type?: unknown; text?: unknown };
          return block.type === "text" && typeof block.text === "string"
            ? block.text
            : "";
        })
        .join("");
    }
  }
  return "";
}

/** Minimale OpenAI-transportfake: volledige chat.completion-vorm zodat óók
 *  de echte agentscope-runtime (openai-client met pydantic-validatie) hem
 *  accepteert; /v1/models dient als readiness-probedoel. */
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
    if (req.method === "GET" && req.url === "/v1/models") {
      json(200, {
        object: "list",
        data: [
          {
            id: "conformance-model",
            object: "model",
            created: 0,
            owned_by: "motor-conformance-fake",
          },
        ],
      });
      return;
    }
    if (req.method === "POST" && req.url === "/v1/chat/completions") {
      const parsed = JSON.parse(body) as {
        model?: string;
        messages?: unknown;
      };
      const input = extractPrompt(parsed.messages);
      json(200, {
        id: "chatcmpl-conformance-0001",
        object: "chat.completion",
        created: 1766000000,
        model: parsed.model ?? "conformance-model",
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: `conformance draft: ${input}`,
            },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      });
      return;
    }
    json(404, { error: "not_found" });
  });
}

// ---------------------------------------------------------------------------
// Echte sidecar-subprocessen (python3, uitsluitend loopback)
// ---------------------------------------------------------------------------

type BindingMode = "real" | "fake";

interface SidecarHandle {
  readonly url: string;
  readonly mode: BindingMode;
  readonly stop: () => Promise<void>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

function stopChild(child: ChildProcess): Promise<void> {
  return new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.killed) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
    }, 5_000);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
    child.kill("SIGTERM");
  });
}

/** Start een sidecar.py als echt python3-subproces en wacht tot /health
 *  serveert (HTTP 200 — de status kan bij een bereikbare fake "ok" zijn).
 *  Iedere startfout is een harde failure: nooit stilletjes terugvallen. */
async function startRealSidecar(options: {
  readonly label: string;
  readonly scriptPath: string;
  readonly env: Record<string, string>;
  readonly portEnvVar: string;
  readonly readyTimeoutMs?: number;
}): Promise<SidecarHandle> {
  const port = await getFreePort();
  const child = spawn("python3", [options.scriptPath], {
    env: {
      PATH: process.env.PATH ?? "",
      HOME: process.env.HOME ?? "/tmp",
      PYTHONUNBUFFERED: "1",
      OTEL_SDK_DISABLED: "true",
      ...options.env,
      [options.portEnvVar]: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf8");
  });
  child.stderr.on("data", (chunk: Buffer) => {
    output += chunk.toString("utf8");
  });
  let exitInfo = "";
  child.once("exit", (code, signal) => {
    exitInfo = `exit=${String(code)} signal=${String(signal)}`;
  });

  const url = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + (options.readyTimeoutMs ?? 20_000);
  for (;;) {
    if (exitInfo !== "") {
      throw new Error(
        `${options.label}-sidecar stopte tijdens het opstarten (${exitInfo}): ` +
          output.trim().slice(-600),
      );
    }
    try {
      const response = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(1_000),
      });
      if (response.ok) break;
    } catch {
      // proces serveert nog niet — poll verder
    }
    if (Date.now() > deadline) {
      await stopChild(child);
      throw new Error(
        `${options.label}-sidecar niet gereed binnen de deadline: ` +
          output.trim().slice(-600),
      );
    }
    await sleep(100);
  }
  return {
    url,
    mode: "real",
    stop: () => stopChild(child),
  };
}

function startHermesSidecar(openaiUrl: string): Promise<SidecarHandle> {
  return startRealSidecar({
    label: "hermes",
    scriptPath: HERMES_SIDECAR_PY,
    portEnvVar: "HERMES_SIDECAR_PORT",
    env: {
      HERMES_SIDECAR_HOST: "127.0.0.1",
      MODEL_PORT_URL: `${openaiUrl}/v1`,
      MODEL_NAME: "conformance-model",
      MODEL_REQUEST_TIMEOUT_S: "10",
    },
  });
}

function startAgentScopeSidecar(openaiUrl: string): Promise<SidecarHandle> {
  return startRealSidecar({
    label: "agentscope",
    scriptPath: AGENTSCOPE_SIDECAR_PY,
    portEnvVar: "AGENTSCOPE_SIDECAR_PORT",
    readyTimeoutMs: 60_000,
    env: {
      AGENTSCOPE_SIDECAR_HOST: "127.0.0.1",
      MODEL_PORT_URL: `${openaiUrl}/v1`,
      MODEL_NAME: "conformance-model",
      MODEL_TIMEOUT_MS: "10000",
    },
  });
}

async function asFakeHandle(server: FakeServer): Promise<SidecarHandle> {
  return { url: server.url, mode: "fake", stop: server.close };
}

/** Verifieer dat een echt sidecar-proces het vastgelegde protocol declareert
 *  (elke respons — ook /health — draagt "protocol": "motor-sidecar/1"). */
async function assertRealProtocol(handle: SidecarHandle): Promise<void> {
  const response = await fetch(`${handle.url}/health`, {
    signal: AbortSignal.timeout(2_000),
  });
  assert.equal(response.status, 200, "echte sidecar serveert /health");
  const payload = (await response.json()) as { protocol?: unknown };
  assert.equal(
    payload.protocol,
    "motor-sidecar/1",
    "echte sidecar declareert motor-sidecar/1",
  );
}

// ---------------------------------------------------------------------------
// De gezamenlijke run
// ---------------------------------------------------------------------------

const bindingModes: Record<string, BindingMode> = {};

test("conformance: vijf bindingen, één semantiek", async (t) => {
  const openai = await startOpenAiFake();
  const hermes = PYTHON3.ok
    ? await startHermesSidecar(openai.url)
    : await asFakeHandle(await startPhase0Sidecar());
  const agentscope = AGENTSCOPE_IMPORTABLE.ok
    ? await startAgentScopeSidecar(openai.url)
    : await asFakeHandle(await startPhase0Sidecar());
  bindingModes.hermes = hermes.mode;
  bindingModes.agentscope = agentscope.mode;
  t.diagnostic(
    `sidecar-modi: hermes=${hermes.mode} (python3: ${PYTHON3.detail}); ` +
      `agentscope=${agentscope.mode} (${AGENTSCOPE_IMPORTABLE.detail})`,
  );
  try {
    if (hermes.mode === "real") await assertRealProtocol(hermes);
    if (agentscope.mode === "real") await assertRealProtocol(agentscope);

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
        baseUrl: hermes.url,
        invokeTimeoutMs: 30_000,
      }),
      agentscope: createAgentScopeAdapter({
        sidecarUrl: agentscope.url,
        invokeTimeoutMs: 30_000,
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
    await hermes.stop();
    await agentscope.stop();
    await openai.close();
  }
});

test("conformance: echte-sidecar-modus is expliciet vastgelegd", (t) => {
  t.diagnostic(
    `gemeten modi: hermes=${bindingModes.hermes ?? "?"}; ` +
      `agentscope=${bindingModes.agentscope ?? "?"}`,
  );
  if (!PYTHON3.ok) {
    t.skip(
      `python3 ontbreekt hier (${PYTHON3.detail}); sidecar-bindingen liepen ` +
        "via de fase-0-fake — de echte-sidecar-conformance draait in de " +
        "python-forziene builderrun (zie LANE-D-CONFORMANCE.md)",
    );
    return;
  }
  assert.equal(
    bindingModes.hermes,
    "real",
    "hermes is stdlib-only en MOET echt draaien zodra python3 bestaat",
  );
  if (!AGENTSCOPE_IMPORTABLE.ok) {
    t.skip(
      `agentscope-runtime ontbreekt (${AGENTSCOPE_IMPORTABLE.detail}); ` +
        "de agentscope-binding liep expliciet via de fase-0-fake",
    );
    return;
  }
  assert.equal(
    bindingModes.agentscope,
    "real",
    "agentscope draait echt zodra het package importeerbaar is",
  );
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
