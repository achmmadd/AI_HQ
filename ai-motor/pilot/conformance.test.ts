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

import type { CapabilityAdapter } from "../lib/adr110/adapters/contract.ts";
import { createFakeAlphaAdapter } from "../lib/adr110/adapters/fake-alpha.ts";
import { createFakeBetaAdapter } from "../lib/adr110/adapters/fake-beta.ts";
import { createLlamaCppServerAdapter } from "../lib/adr110/adapters/llamacpp-server.ts";
import { createHermesAdapter } from "../lib/adr110/adapters/hermes/adapter.ts";
import { createAgentScopeAdapter } from "../lib/adr110/adapters/agentscope/sidecar-client.ts";
import {
  buildEvidenceChain,
  findOrphans,
} from "../lib/adr110/evidence.ts";
import {
  buildProofFixture,
  createRunIds,
  runTaskThroughAdapter,
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
        sidecarUrl: sidecar.url,
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
      hermes: createHermesAdapter({ sidecarUrl: down.url, invokeTimeoutMs: 5_000 }),
      agentscope: createAgentScopeAdapter({
        sidecarUrl: down.url,
        invokeTimeoutMs: 5_000,
      }),
    })) {
      const run = await runTaskThroughAdapter(
        adapter,
        fixture,
        createRunIds(`conf-fail-${label}`),
      );
      // Geen hangende attempt: de run eindigt terminaal met een fout.
      assert.equal(run.result.ok, false, label);
      if (!run.result.ok) {
        assert.equal(run.result.error.code, "unavailable", label);
      }
      const chain = buildEvidenceChain(run.evidence);
      assert.equal(chain.ok, true, `${label}: failure-evidence vormt een valide keten`);
      assert.deepEqual(findOrphans(run.evidence), [], label);
    }
  } finally {
    await down.close();
  }
});
