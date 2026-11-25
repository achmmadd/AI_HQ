/**
 * ADR-110 pure contract proof — public API.
 *
 * This barrel deliberately exports only types, constants and pure functions.
 * There is no store, no database, no persistence, no credential holder and no
 * mutable module-level state anywhere in this module (see PROOF.md).
 */

export { ADR110_SCHEMA_VERSION, branded, isoTimestamp, isIsoTimestamp, compareIso, CONTEXT_KINDS, DATA_CLASSES } from "./types.ts";
export type {
  Brand,
  WorkspaceId,
  TenantId,
  IdentityId,
  EmployeeId,
  TaskId,
  RunId,
  AttemptId,
  AgentId,
  ContextItemId,
  PolicyId,
  ActionId,
  EvidenceId,
  EventId,
  Sha256Digest,
  IsoTimestamp,
  Identity,
  Employee,
  Task,
  TaskStatus,
  ContextKind,
  DataClass,
  ContextScope,
  ContextProvenance,
  ContextItem,
  ManifestItemRef,
  PolicyRef,
  SelectionDecision,
  ContextManifest,
  RiskClass,
  CapabilityPolicy,
  Policy,
  ActionRequest,
  EvidenceStage,
  EvidenceRecord,
  EvaluationCriteria,
  Run,
  Attempt,
  Agent,
  RuntimeBinding,
  ModelBinding,
} from "./types.ts";

export { canonicalJson, sha256Hex, digestOf, isSha256Digest, deepFreeze } from "./digest.ts";

export {
  validateContextItem,
  computeItemDigest,
  buildContextManifest,
  validateManifest,
  bindManifest,
  manifestSemanticsEqual,
} from "./context.ts";
export type { ValidationResult, BuildManifestInput, BuildManifestResult, BindManifestResult } from "./context.ts";

export {
  initialEngineState,
  applyEngineEventToEngine,
  initialKernelProjection,
  applyEngineEvent,
} from "./engine.ts";
export type { EngineEvent, EngineEventType, EngineState, TaskProjection, KernelProjection, TaskSeed } from "./engine.ts";

export {
  evaluatePolicy,
  createGateway,
  policyRefOf,
  computePolicyDigest,
  argumentHashOf,
} from "./gateway.ts";
export type { GatewayDecision, Approval, GatewayEvaluation, GatewayReceipt, MintResult, ExecutionResult, Gateway } from "./gateway.ts";

export {
  UNAUTHORIZED_ATTEMPT_KIND,
  computeEvidenceDigest,
  makeEvidenceRecord,
  buildEvidenceChain,
  findOrphans,
  isChainValid,
} from "./evidence.ts";
export type { EvidenceChain, BuildChainResult } from "./evidence.ts";

export { computeEvaluation } from "./evaluation.ts";
export type { HumanReview, OutcomeData, CostData } from "./evaluation.ts";

export { ADAPTER_CONTRACT_MEMBERS } from "./adapters/contract.ts";
export type {
  AdapterRequirements,
  AdapterHealth,
  AdapterInvokeRequest,
  AdapterResultMeta,
  AdapterError,
  AdapterResult,
  AdapterCancelResult,
  CapabilityAdapter,
} from "./adapters/contract.ts";

export { createFakeAlphaAdapter, FAKE_ALPHA_ID, FAKE_ALPHA_VERSION } from "./adapters/fake-alpha.ts";
export { createFakeBetaAdapter, FAKE_BETA_ID, FAKE_BETA_VERSION } from "./adapters/fake-beta.ts";

export {
  PROOF_WORKSPACE_ID,
  OTHER_WORKSPACE_ID,
  PROOF_TASK_ID,
  buildProofFixture,
  makeContextItem,
  createRunIds,
  runTaskThroughAdapter,
} from "./scenario.ts";
export type { ProofFixture, RunIds, RunThroughResult } from "./scenario.ts";
