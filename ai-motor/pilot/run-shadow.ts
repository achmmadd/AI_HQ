/**
 * run-shadow.ts — Motor shadow-pilot CLI runner (one-shot).
 *
 * One synthetic ReviewReceived input → ADR-110 spine (context manifest,
 * engine events, deny-by-default gateway, causal evidence chain) → the real
 * llamacpp-server adapter → one JSON result on stdout:
 *
 *   { ok, draft, evidence, modelMeta: { model, latencyMs, tokensIndicatie },
 *     gateway, manifest, chainValid }
 *
 * Deny by default: no action tools are registered, no writes, no network
 * except MODEL_PORT_URL. The only file read is the prompt template next to
 * this script. Exit code 0 on ok, 1 on adapter/chain failure.
 *
 * Env:
 *   MODEL_PORT_URL   base URL of llama-server (default http://100.118.204.123:8080)
 *   MODEL_NAME       model name in the request body (default UD-Q4_K_XL quant)
 *   MODEL_TIMEOUT_MS per-request timeout (default 120000)
 */

import { readFile } from "node:fs/promises";

import {
  ADR110_SCHEMA_VERSION,
  branded,
  isoTimestamp,
  deepFreeze,
  makeContextItem,
  buildContextManifest,
  makeEvidenceRecord,
  buildEvidenceChain,
  findOrphans,
  createGateway,
  computePolicyDigest,
  initialKernelProjection,
  applyEngineEvent,
} from "../lib/adr110/index.ts";
import type {
  ActionRequest,
  Agent,
  ContextItem,
  Employee,
  EngineEvent,
  EvidenceRecord,
  Identity,
  ModelBinding,
  Policy,
  PolicyId,
  RunId,
  RuntimeBinding,
  Task,
  TaskId,
  WorkspaceId,
  AttemptId,
  AgentId,
} from "../lib/adr110/index.ts";
import { createLlamaCppServerAdapter } from "../lib/adr110/adapters/llamacpp-server.ts";

const MODEL_PORT_URL =
  process.env.MODEL_PORT_URL ?? "http://100.118.204.123:8080";
const MODEL_NAME =
  process.env.MODEL_NAME ?? "Qwen3.6-35B-A3B-UD-Q4_K_XL";
const MODEL_TIMEOUT_MS = Number(process.env.MODEL_TIMEOUT_MS ?? "120000");

// Synthetic ReviewReceived input (hardcoded; no real customer data).
const SYNTHETIC_REVIEW = `★★★★☆ — "Fijne B&B, héérlijk ontbijt, maar lawaaierige straat"
We sliepen drie nachten in de kamer aan de voorkant. Het ontbijt was uitstekend:
verse croissants, goede koffie en een gekookt eitje erbij. De ontvangst was hartelijk.
Minpunt: in de nacht veel geluidsoverlast van verkeer op de straat, ook met het
raam dicht. Verder niets te klagen. — Gast (3 nachten, kamer aan de straatzijde)`;

const ONDERNEMER_CONTEXT = `B&B "De Linde", familiebedrijf in het centrum.
Het ontbijt wordt elke ochtend vers bereid door de mede-eigenaar.
De kamers aan de straatzijde hebben dubbel glas; de gemeente is aangeschreven
over het nachtelijke verkeerslawaai. Reageer namens de eigenaar.`;

function nowIso() {
  return isoTimestamp(new Date().toISOString());
}

async function renderPrompt(): Promise<string> {
  const url = new URL("./prompts/review-draft.md", import.meta.url);
  const raw = await readFile(url, "utf8");
  const body = raw.replace(/^\s*<!--[\s\S]*?-->/, "").trim();
  const filled = body
    .replaceAll("{{REVIEW_TEKST}}", SYNTHETIC_REVIEW)
    .replaceAll("{{ONDERNEMER_CONTEXT}}", ONDERNEMER_CONTEXT);
  if (filled.includes("{{")) {
    throw new Error("prompt template has unfilled variables");
  }
  return filled;
}

async function main(): Promise<number> {
  const t0 = nowIso();
  const label = `shadow-${Date.parse(t0)}`;
  const workspace_id = branded<WorkspaceId>("ws-motor");
  const task_id = branded<TaskId>("task-shadow-review-1");
  const run_id = branded<RunId>(`run-${label}`);
  const attempt_id = branded<AttemptId>(`att-${label}`);

  const identity: Identity = deepFreeze({
    schema_version: ADR110_SCHEMA_VERSION,
    identity_id: branded("identity-pietje"),
    kind: "human",
    display_name: "Pietje",
    workspace_id,
    tenant_id: branded("tenant-motor"),
  });
  const employee: Employee = deepFreeze({
    schema_version: ADR110_SCHEMA_VERSION,
    employee_id: branded("employee-review-responder"),
    workspace_id,
    role: "ReviewResponder",
    mandate: ["draft review replies", "never publish without approval"],
    owner_identity_id: identity.identity_id,
  });
  const task: Task = deepFreeze({
    schema_version: ADR110_SCHEMA_VERSION,
    task_id,
    workspace_id,
    employee_id: employee.employee_id,
    title: "Shadow: draft a reply to the synthetic B&B review",
    status: "assigned",
    created_at: t0,
  });

  const policyContent = {
    schema_version: ADR110_SCHEMA_VERSION,
    policy_id: branded<PolicyId>("policy-motor-default"),
    version: "1.0.0",
    workspace_id,
    capabilities: {
      "draft.generate": {
        risk: "R0",
        requires_approval: false,
        budget_cents_max: 100,
        allowed_data_classes: ["public", "internal"],
        network: "none",
      },
      "review.reply.publish": {
        risk: "R2",
        requires_approval: true,
        budget_cents_max: 50,
        allowed_data_classes: ["public", "internal"],
        network: "egress",
      },
    },
  } as const;
  const policy: Policy = deepFreeze({
    ...policyContent,
    digest: computePolicyDigest(policyContent),
  });
  const gateway = createGateway(policy);

  const items: readonly ContextItem[] = [
    makeContextItem({
      item_id: "ctx-shadow-review",
      kind: "task",
      data_class: "internal",
      scope: { type: "task", workspace_id, task_id },
      payload: { title: task.title, source: "ReviewReceived", synthetic: true },
      created_at: t0,
      produced_by: "pilot:run-shadow",
      source: "synthetic-review",
    }),
    makeContextItem({
      item_id: "ctx-shadow-plan",
      kind: "plan",
      data_class: "internal",
      scope: { type: "workspace", workspace_id },
      payload: { steps: ["acknowledge", "address noise point", "thank"] },
      created_at: t0,
      produced_by: "pilot:run-shadow",
      source: "synthetic-review",
    }),
    makeContextItem({
      item_id: "ctx-shadow-tone",
      kind: "finding",
      data_class: "public",
      scope: {
        type: "employee",
        workspace_id,
        employee_id: employee.employee_id,
      },
      payload: { tone: "zakelijk-vriendelijk", language: "nl" },
      created_at: t0,
      produced_by: "pilot:run-shadow",
      source: "synthetic-review",
    }),
  ];

  const built = buildContextManifest({
    task,
    run_id,
    attempt_id,
    items,
    policy: {
      policy_id: policy.policy_id,
      version: policy.version,
      digest: policy.digest,
    },
    now: t0,
  });
  if (!built.ok) {
    throw new Error(`manifest must build: ${built.errors.join("; ")}`);
  }
  const manifest = built.manifest;

  const agent: Agent = deepFreeze({
    schema_version: ADR110_SCHEMA_VERSION,
    agent_id: branded<AgentId>(`agent-${label}`),
    attempt_id,
    profile: "review-drafter",
    delegated_by: employee.employee_id,
  });
  const runtime: RuntimeBinding = deepFreeze({
    runtime: "llama.cpp llama-server (RTX-pc via Tailscale)",
    harness: "pilot-run-shadow",
  });
  const model: ModelBinding = deepFreeze({
    provider: "llamacpp-server",
    model: MODEL_NAME,
  });

  const adapter = createLlamaCppServerAdapter({
    baseUrl: MODEL_PORT_URL,
    model: MODEL_NAME,
    timeoutMs: MODEL_TIMEOUT_MS,
    maxTokens: 512,
    temperature: 0.3,
  });

  const health = await adapter.health(t0);
  const prompt = await renderPrompt();

  const engine_events: EngineEvent[] = [
    {
      schema_version: ADR110_SCHEMA_VERSION,
      event_id: branded(`evt-${label}-run-started`),
      seq: 1,
      workspace_id,
      task_id,
      run_id,
      type: "run.started",
      occurred_at: t0,
    },
    {
      schema_version: ADR110_SCHEMA_VERSION,
      event_id: branded(`evt-${label}-att-started`),
      seq: 2,
      workspace_id,
      task_id,
      run_id,
      attempt_id,
      type: "attempt.started",
      occurred_at: nowIso(),
    },
  ];

  const result = await adapter.invoke({
    task_id,
    run_id,
    attempt_id,
    manifest,
    agent,
    runtime,
    model,
    input: prompt,
  });

  const tEnd = nowIso();
  engine_events.push(
    {
      schema_version: ADR110_SCHEMA_VERSION,
      event_id: branded(`evt-${label}-att-end`),
      seq: 3,
      workspace_id,
      task_id,
      run_id,
      attempt_id,
      type: result.ok ? "attempt.succeeded" : "attempt.failed",
      occurred_at: tEnd,
    },
    {
      schema_version: ADR110_SCHEMA_VERSION,
      event_id: branded(`evt-${label}-run-end`),
      seq: 4,
      workspace_id,
      task_id,
      run_id,
      type: result.ok ? "run.completed" : "run.failed",
      occurred_at: tEnd,
    },
  );

  // Kernel projection (Task-only truth) over the engine events.
  let projection = initialKernelProjection();
  for (const event of engine_events) {
    projection = applyEngineEvent(projection, event);
  }

  // Deny-by-default probe: a publish action without a Gateway receipt is
  // refused. No action tools are registered anywhere in this runner.
  const publishRequest: ActionRequest = deepFreeze({
    schema_version: ADR110_SCHEMA_VERSION,
    action_id: branded(`act-${label}-publish`),
    workspace_id,
    task_id,
    run_id,
    attempt_id,
    capability: "review.reply.publish",
    tool: "review.publish",
    args: { draft: result.ok ? result.output : null },
    data_class: "public",
    estimated_cost_cents: 0,
    requested_by: employee.employee_id,
    requested_at: tEnd,
  });
  const publishProbe = gateway.executeAction(publishRequest, null, tEnd);

  const evidence: EvidenceRecord[] = [];
  const evTask = makeEvidenceRecord({
    evidence_id: branded(`ev-${label}-task`),
    stage: "task",
    task_id,
    subject_id: task_id as string,
    kind_detail: "task.assigned",
    data: { employee_id: employee.employee_id, title: task.title, synthetic: true },
    occurred_at: t0,
  });
  evidence.push(evTask);
  const evRun = makeEvidenceRecord({
    evidence_id: branded(`ev-${label}-run`),
    stage: "run",
    task_id,
    run_id,
    subject_id: run_id as string,
    parent_evidence_id: evTask.evidence_id,
    kind_detail: "run.started",
    data: { engine: "pilot-run-shadow" },
    occurred_at: t0,
  });
  evidence.push(evRun);
  const evAttempt = makeEvidenceRecord({
    evidence_id: branded(`ev-${label}-attempt`),
    stage: "attempt",
    task_id,
    run_id,
    attempt_id,
    subject_id: attempt_id as string,
    parent_evidence_id: evRun.evidence_id,
    kind_detail: "context.manifest.bound",
    data: {
      total_digest: manifest.total_digest,
      item_count: manifest.items.length,
      policy_digest: manifest.policy.digest,
      agent_id: agent.agent_id,
      adapter_id: adapter.adapter_id,
    },
    occurred_at: t0,
  });
  evidence.push(evAttempt);
  const evArtifact = makeEvidenceRecord({
    evidence_id: branded(`ev-${label}-artifact`),
    stage: "artifact",
    task_id,
    run_id,
    attempt_id,
    subject_id: `artifact-${label}`,
    parent_evidence_id: evAttempt.evidence_id,
    kind_detail: "adapter.result",
    data: result.ok
      ? {
          output: result.output,
          cost_cents: result.meta.simulated_cost_cents,
          adapter_id: adapter.adapter_id,
          adapter_version: adapter.adapter_version,
        }
      : { error: result.error },
    occurred_at: tEnd,
  });
  evidence.push(evArtifact);
  const evGateway = makeEvidenceRecord({
    evidence_id: branded(`ev-${label}-gateway`),
    stage: "action",
    task_id,
    run_id,
    attempt_id,
    subject_id: publishRequest.action_id as string,
    parent_evidence_id: evAttempt.evidence_id,
    kind_detail: "gateway.decision",
    data: {
      capability: "review.reply.publish",
      probe: true,
      executed: publishProbe.executed,
      ...(!publishProbe.executed
        ? { decision: publishProbe.decision, reason: publishProbe.reason }
        : {}),
    },
    occurred_at: tEnd,
  });
  evidence.push(evGateway);
  const evOutcome = makeEvidenceRecord({
    evidence_id: branded(`ev-${label}-outcome`),
    stage: "outcome",
    task_id,
    run_id,
    attempt_id,
    subject_id: `outcome-${label}`,
    parent_evidence_id: evArtifact.evidence_id,
    kind_detail: "shadow.draft_pending_review",
    data: {
      status: result.ok ? "success" : "failure",
      shadow: true,
      draft_pending_human_review: true,
    },
    occurred_at: tEnd,
  });
  evidence.push(evOutcome);

  const chain = buildEvidenceChain(evidence);
  const orphans = findOrphans(evidence);

  const latencyMs = result.ok ? result.meta.simulated_latency_ms : null;
  const output = {
    ok: result.ok && chain.ok && orphans.length === 0,
    draft: result.ok ? result.output : null,
    ...(result.ok ? {} : { error: result.error }),
    evidence,
    modelMeta: {
      model: MODEL_NAME,
      baseUrl: MODEL_PORT_URL,
      health: health.status,
      latencyMs,
      // Indicatie: ~4 tekens per token, prompt + draft (llama-server usage
      // zit niet in het contract-meta; dit is bewust een schatting).
      tokensIndicatie: Math.ceil(
        (prompt.length + (result.ok ? result.output.length : 0)) / 4,
      ),
    },
    gateway: {
      publishProbe: publishProbe.executed
        ? { executed: true }
        : {
            executed: false,
            decision: publishProbe.decision,
            reason: publishProbe.reason,
          },
    },
    manifest: {
      total_digest: manifest.total_digest,
      item_count: manifest.items.length,
      policy_digest: manifest.policy.digest,
    },
    kernelTaskStatus:
      projection.tasks[task_id as string]?.status ?? "unknown",
    chainValid: chain.ok,
    orphans: orphans.length,
  };

  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  return output.ok ? 0 : 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stdout.write(
      `${JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      })}\n`,
    );
    process.exitCode = 1;
  });
