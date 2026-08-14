/**
 * draft-core.ts — gedeelde kern van de Motor shadow-pilot.
 *
 * Bevat de complete één-shot flow (context manifest, engine events,
 * deny-by-default gateway-probe, causale evidence-keten, echte
 * llamacpp-server adapter) als herbruikbare functie. Zowel de CLI
 * (run-shadow.ts) als de API (server.ts) roepen runDraft() aan;
 * gedrag is daardoor per definitie identiek.
 */

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import {
  ADR110_SCHEMA_VERSION,
  applyEngineEvent,
  branded,
  isoTimestamp,
  deepFreeze,
  makeContextItem,
  buildContextManifest,
  makeEvidenceRecord,
  buildEvidenceChain,
  findOrphans,
  createGateway,
  initialKernelProjection,
  computePolicyDigest,
} from "../lib/adr110/index.ts";
import type {
  ActionRequest,
  Agent,
  ContextItem,
  Employee,
  EngineEvent,
  EvidenceRecord,
  ModelBinding,
  Policy,
  PolicyId,
  RunId,
  RuntimeBinding,
  Task,
  TaskId,
  AttemptId,
  AgentId,
  IdentityId,
  WorkspaceId,
} from "../lib/adr110/index.ts";
import { createLlamaCppServerAdapter } from "../lib/adr110/adapters/llamacpp-server.ts";
import type { CapabilityAdapter } from "../lib/adr110/adapters/contract.ts";
import { storeDraftViaService } from "./draft-store.ts";

// Geen echte endpoints in de repo: de default is localhost, de echte
// tailnet-URL leeft uitsluitend als runtime-env op Hetzner (.env, gitignored).
const MODEL_PORT_URL = process.env.MODEL_PORT_URL ?? "http://127.0.0.1:8080";
const MODEL_NAME =
  process.env.MODEL_NAME ?? "Qwen3.6-35B-A3B-UD-Q4_K_XL";
const MODEL_TIMEOUT_MS = Number(process.env.MODEL_TIMEOUT_MS ?? "120000");

// Default input is synthetisch (geen echte klantdata) zodat CI/tests altijd
// dezelfde keten draaien.
export const SYNTHETIC_REVIEW = `★★★★☆ — "Fijne B&B, héérlijk ontbijt, maar lawaaierige straat"
We sliepen drie nachten in de kamer aan de voorkant. Het ontbijt was uitstekend:
verse croissants, goede koffie en een gekookt eitje erbij. De ontvangst was hartelijk.
Minpunt: in de nacht veel geluidsoverlast van verkeer op de straat, ook met het
raam dicht. Verder niets te klagen. — Gast (3 nachten, kamer aan de straatzijde)`;

export const DEFAULT_CONTEXT = `B&B "De Linde", familiebedrijf in het centrum.
Het ontbijt wordt elke ochtend vers bereid door de mede-eigenaar.
De kamers aan de straatzijde hebben dubbel glas; de gemeente is aangeschreven
over het nachtelijke verkeerslawaai. Reageer namens de eigenaar.`;

export interface DraftRequest {
  readonly reviewText: string;
  /**
   * Optioneel. Zonder expliciete context wordt tijdens runtime geprobeerd het
   * privé contextvolume te lezen (CONTEXT_FILE, default
   * /data/ondernemer-context.txt op het Hetzner-volume); zonder dat volume
   * valt de pilot terug op de expliciete demodata (DEFAULT_CONTEXT, "De
   * Linde"). Echte bedrijfscontext komt dus nooit uit de repo — alleen uit
   * het privé-volume of een bewuste runtime-aanroep.
   */
  readonly contextText?: string;
  readonly isSynthetic: boolean;
}

export type ContextSource = "request" | "volume" | "demo";

export interface ResolvedContext {
  readonly text: string;
  readonly source: ContextSource;
}

export const CONTEXT_FILE =
  process.env.CONTEXT_FILE ?? "/data/ondernemer-context.txt";

/**
 * Context-resolutie. De inhoud wordt nooit gelogd en nooit opgenomen in
 * evidence — alleen de bron ("request" | "volume" | "demo") is zichtbaar.
 */
export async function resolveContext(
  req: Pick<DraftRequest, "contextText">,
  contextFile: string | false = CONTEXT_FILE,
): Promise<ResolvedContext> {
  if (typeof req.contextText === "string" && req.contextText.trim()) {
    return { text: req.contextText, source: "request" };
  }
  if (contextFile !== false) {
    try {
      const text = await readFile(contextFile, "utf8");
      if (text.trim()) {
        return { text, source: "volume" };
      }
    } catch {
      // Geen privé-volume (of niet leesbaar) → expliciete demo-fallback.
    }
  }
  return { text: DEFAULT_CONTEXT, source: "demo" };
}

/** Test-/vervangingspunten; productie gebruikt de defaults. */
export interface DraftDeps {
  readonly adapter?: CapabilityAdapter;
  readonly storeFn?: typeof storeDraftViaService;
  /** false = contextvolume nooit lezen (tests, CI). */
  readonly contextFile?: string | false;
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function nowIso() {
  return isoTimestamp(new Date().toISOString());
}

async function renderPrompt(
  req: DraftRequest & { contextText: string },
): Promise<string> {
  const url = new URL("./prompts/review-draft.md", import.meta.url);
  const raw = await readFile(url, "utf8");
  const body = raw.replace(/^\s*<!--[\s\S]*?-->/, "").trim();
  const filled = body
    .replaceAll("{{REVIEW_TEKST}}", req.reviewText)
    .replaceAll("{{ONDERNEMER_CONTEXT}}", req.contextText);
  if (filled.includes("{{")) {
    throw new Error("prompt template has unfilled variables");
  }
  return filled;
}

export async function runDraft(req: DraftRequest, deps: DraftDeps = {}) {
  const { isSynthetic } = req;
  const context = await resolveContext(req, deps.contextFile ?? CONTEXT_FILE);
  const effectiveReq = { ...req, contextText: context.text };
  const t0 = nowIso();
  const label = `shadow-${Date.parse(t0)}`;
  const workspace_id = branded<WorkspaceId>("ws-motor");
  const task_id = branded<TaskId>("task-shadow-review-1");
  const run_id = branded<RunId>(`run-${label}`);
  const attempt_id = branded<AttemptId>(`att-${label}`);

  const identity = deepFreeze({
    schema_version: ADR110_SCHEMA_VERSION,
    identity_id: branded<IdentityId>("identity-owner-pietje"),
    kind: "human" as const,
    display_name: "Pietje (eigenaar)",
    workspace_id,
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
    title: isSynthetic
      ? "Shadow: draft a reply to the synthetic B&B review"
      : "Shadow: draft a reply to an operator-supplied review",
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
      // Eerste echte koppeling: append-only conceptopslag. R0: intern,
      // geen netwerk, geen kosten — ALLOW zonder approval, mét receipt.
      "draft.store": {
        risk: "R0",
        requires_approval: false,
        budget_cents_max: 0,
        allowed_data_classes: ["internal"],
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

  const inputSource = isSynthetic ? "synthetic-review" : "operator-input";
  const items: readonly ContextItem[] = [
    makeContextItem({
      item_id: "ctx-shadow-review",
      kind: "task",
      data_class: "internal",
      scope: { type: "task", workspace_id, task_id },
      payload: {
        title: task.title,
        source: "ReviewReceived",
        synthetic: isSynthetic,
      },
      created_at: t0,
      produced_by: "pilot:run-shadow",
      source: inputSource,
    }),
    makeContextItem({
      item_id: "ctx-shadow-plan",
      kind: "plan",
      data_class: "internal",
      scope: { type: "workspace", workspace_id },
      payload: { steps: ["acknowledge", "address noise point", "thank"] },
      created_at: t0,
      produced_by: "pilot:run-shadow",
      source: inputSource,
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
      source: inputSource,
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

  const adapter =
    deps.adapter ??
    createLlamaCppServerAdapter({
      baseUrl: MODEL_PORT_URL,
      model: MODEL_NAME,
      timeoutMs: MODEL_TIMEOUT_MS,
      maxTokens: 512,
      temperature: 0.3,
    });
  const storeFn = deps.storeFn ?? storeDraftViaService;

  const health = await adapter.health(t0);
  const prompt = await renderPrompt(effectiveReq);

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

  // Eerste echte koppeling achter de gateway: draft.store. Alleen bij een
  // geslaagde draft. De gateway mint een receipt (R0 → ALLOW) en
  // executeAction levert een settlement — pas dán schrijft de store-adapter.
  type StoreOutcome =
    | {
        decision: "ALLOW";
        executed: true;
        stored: boolean;
        path: string;
        receipt_id: string;
        error?: string;
      }
    | { decision: "DENY" | "REQUIRE_APPROVAL"; executed: false; stored: false; reason: string };
  let storeOutcome: StoreOutcome;
  let storeRequest: ActionRequest | null = null;
  if (!result.ok) {
    storeOutcome = {
      decision: "DENY",
      executed: false,
      stored: false,
      reason: "no draft to store",
    };
  } else {
    storeRequest = deepFreeze({
      schema_version: ADR110_SCHEMA_VERSION,
      action_id: branded(`act-${label}-store`),
      workspace_id,
      task_id,
      run_id,
      attempt_id,
      capability: "draft.store",
      tool: "draft.store.local",
      args: { run_id, draft: result.output },
      data_class: "internal",
      estimated_cost_cents: 0,
      requested_by: employee.employee_id,
      requested_at: tEnd,
    });
    const minted = gateway.mintReceipt(storeRequest, tEnd);
    if (!minted.ok) {
      storeOutcome = {
        decision: minted.decision,
        executed: false,
        stored: false,
        reason: minted.reasons.join("; "),
      };
    } else {
      const settled = gateway.executeAction(storeRequest, minted.receipt, nowIso());
      if (!settled.executed) {
        storeOutcome = {
          decision: "DENY",
          executed: false,
          stored: false,
          reason: settled.reason,
        };
      } else {
        // Alleen de store-service schrijft; wij dienen de opdracht in met
        // het settlement-bewijs van de gateway.
        const stored = await storeFn(
          {
            stored_at: tEnd,
            run_id: run_id as string,
            receipt_id: settled.settlement.receipt_id,
            synthetic: isSynthetic,
            review: req.reviewText,
            draft: result.output,
          },
          settled.settlement,
        );
        storeOutcome = {
          decision: "ALLOW",
          executed: true,
          stored: stored.ok,
          path: "/data/drafts.jsonl (via store-service)",
          receipt_id: settled.settlement.receipt_id,
          ...(stored.ok ? {} : { error: stored.error }),
        };
      }
    }
  }

  // Deny-by-default probe: a publish action without a Gateway receipt is
  // refused. No action tools are registered anywhere in this flow.
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
    data: {
      employee_id: employee.employee_id,
      title: task.title,
      synthetic: isSynthetic,
    },
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
    // Bewust géén bedrijfsinhoud in evidence: alleen hash + omvang + status.
    // De concepttekst zelf leeft in het privé-volume (store) en in het
    // API-antwoord aan de geautoriseerde aanroeper — nooit in receipts/logs.
    data: result.ok
      ? {
          output_sha256: sha256(result.output),
          output_chars: result.output.length,
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
  const evStore = makeEvidenceRecord({
    evidence_id: branded(`ev-${label}-store`),
    stage: "action",
    task_id,
    run_id,
    attempt_id,
    subject_id: storeRequest
      ? (storeRequest.action_id as string)
      : `store-${label}`,
    // PREDECESSOR-regel: action-stage parent is altijd de attempt.
    parent_evidence_id: evAttempt.evidence_id,
    kind_detail: "gateway.settlement.draft.store",
    data: storeOutcome,
    occurred_at: tEnd,
  });
  evidence.push(evStore);
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
  return {
    ok: result.ok && chain.ok && orphans.length === 0,
    draft: result.ok ? result.output : null,
    ...(result.ok ? {} : { error: result.error }),
    evidence,
    contextSource: context.source,
    modelMeta: {
      model: MODEL_NAME,
      // Geen baseUrl: interne endpoints horen niet in API-antwoorden.
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
    store: storeOutcome,
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
}
