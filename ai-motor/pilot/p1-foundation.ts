/**
 * P1 Product Foundation — synthetic typed read-models for the internal Motor AI shell.
 *
 * Motor AI is an internal team platform (spine + koppelingen), not a customer product.
 * This module is in-memory only: no SQLite, no Postgres, no I/O, no live stack.
 *
 * Identity / Employee / Task / Run / Attempt / Agent / Runtime / Model stay
 * separate types. Blocks are composition data: they never execute and are not SSOT.
 */

export const HOME_TENANT_ID = "ws-motor";
export const OTHER_TENANT_ID = "ws-anders";

/** Markers that exist only on internal records and must never reach a view-model. */
export const FORBIDDEN_VIEW_MARKERS = Object.freeze({
  secret: "p1-demo-secret-sk-live-not-real",
  contextBody: "FULL_CONTEXT_BODY annex-4-niet-tonen",
  rawRuntimeLog: "[runtime] TRACE dump stderr token=",
});

/**
 * Hardcoded CRM/legacy department names. P1 departments are configurable
 * shared capabilities + teams — this set must not appear as the taxonomy.
 */
export const LEGACY_DEPARTMENT_TAXONOMY = Object.freeze([
  "sales",
  "finance",
  "hr",
  "marketing",
  "operations",
  "support",
  "crm",
]);

export const PRIMARY_NAV = Object.freeze([
  { id: "now", label: "Nu" },
  { id: "projects", label: "Projecten" },
  { id: "departments", label: "Afdelingen" },
] as const);

export type PrimaryNavId = (typeof PRIMARY_NAV)[number]["id"];
export type AttentionStage = "vraag" | "actief" | "jij_nodig" | "klaar";
export type AttentionKind = "approval" | "failure" | "outcome";
export type EmployeeKind = "human" | "ai";
export type IdentityKind = "human" | "service";
export type PublishDecision = "DENY";
export type ContextStatus = "ready" | "missing";
export type BlockRisk = "low" | "medium" | "high";

export interface P1Identity {
  readonly id: string;
  readonly tenantId: string;
  readonly kind: IdentityKind;
  readonly displayName: string;
}

export interface P1Employee {
  readonly id: string;
  readonly tenantId: string;
  readonly identityId: string;
  readonly kind: EmployeeKind;
  readonly name: string;
  readonly mandate: string;
  readonly capabilities: readonly string[];
}

export interface P1Task {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly employeeId: string;
  readonly title: string;
  readonly status: "assigned" | "in_progress" | "completed" | "failed";
}

export interface P1Run {
  readonly id: string;
  readonly tenantId: string;
  readonly taskId: string;
}

export interface P1Attempt {
  readonly id: string;
  readonly tenantId: string;
  readonly runId: string;
  readonly outcome: "running" | "succeeded" | "failed";
}

export interface P1Agent {
  readonly id: string;
  readonly tenantId: string;
  readonly employeeId: string;
  readonly label: string;
}

export interface P1Runtime {
  readonly id: string;
  readonly tenantId: string;
  readonly label: string;
}

export interface P1Model {
  readonly id: string;
  readonly tenantId: string;
  readonly label: string;
}

export interface P1ContextRef {
  readonly manifestId: string;
  readonly digest: string;
  readonly status: ContextStatus;
}

export interface P1Project {
  readonly id: string;
  readonly tenantId: string;
  readonly departmentId: string;
  readonly name: string;
  readonly goal: string;
  readonly state: "actief" | "jij_nodig";
  readonly context: P1ContextRef;
}

export interface P1Department {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly purpose: string;
  readonly capabilities: readonly string[];
}

export interface P1Assignment {
  readonly id: string;
  readonly tenantId: string;
  readonly employeeId: string;
  readonly projectId: string;
  readonly role: string;
}

export interface P1Artifact {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly label: string;
  readonly kind: "note" | "digest" | "receipt";
}

export interface P1TimelineEvent {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly label: string;
  readonly at: string;
}

export interface P1AttentionItem {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly departmentId: string;
  readonly ownerId: string;
  readonly stage: AttentionStage;
  readonly kind: AttentionKind;
  readonly title: string;
  readonly summary: string;
  readonly references: {
    readonly taskId: string | null;
    readonly runId: string | null;
    readonly attemptId: string | null;
    readonly approvalId: string | null;
    readonly evidenceId: string | null;
  };
}

export type DraftState = "draft" | "ready";
export type ReviewStatus = "draft" | "in_review" | "approved" | "rejected";

export const REVIEW_STATUSES = Object.freeze([
  "draft",
  "in_review",
  "approved",
  "rejected",
] as const satisfies readonly ReviewStatus[]);

export interface P1Draft {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly kind: "draft";
  readonly state: DraftState;
  /** Present only on locally typed P1.1 concepts; seed drafts omit it. */
  readonly origin?: "typed";
  readonly title?: string;
  readonly bodyDigest: string;
}

export interface P1Review {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly draftId: string;
  readonly kind: "review";
  readonly state: ReviewStatus;
}

export interface P1Publish {
  readonly id: string;
  readonly tenantId: string;
  readonly projectId: string;
  readonly reviewId: string;
  readonly kind: "publish";
  readonly decision: PublishDecision;
  readonly reason: string;
  readonly visibleAfterApproved: true;
}

export interface P1BlockManifest {
  readonly id: string;
  readonly tenantId: string;
  readonly name: string;
  readonly schema: readonly string[];
  readonly scopes: readonly string[];
  readonly effects: readonly string[];
  readonly risk: BlockRisk;
  readonly evidence: { readonly digest: string; readonly kind: string };
}

export interface NowView {
  readonly stages: readonly AttentionStage[];
  readonly items: readonly P1AttentionItem[];
}

export interface ProjectView {
  readonly project: P1Project;
  readonly team: ReadonlyArray<{ employee: P1Employee; role: string }>;
  readonly tasks: readonly P1Task[];
  readonly artifacts: readonly P1Artifact[];
  readonly timeline: readonly P1TimelineEvent[];
  readonly drafts: readonly P1Draft[];
  readonly reviews: readonly P1Review[];
  readonly publishes: readonly P1Publish[];
}

export interface RosterEntry {
  readonly identity: P1Identity;
  readonly employee: P1Employee;
  readonly assignments: ReadonlyArray<{ projectId: string; projectName: string; role: string }>;
}

export interface FoundationViewModel {
  readonly tenantId: string;
  readonly organizationName: string;
  readonly nav: typeof PRIMARY_NAV;
  readonly now: NowView;
  readonly projects: readonly ProjectView[];
  readonly departments: readonly P1Department[];
  readonly roster: readonly RosterEntry[];
  readonly blocks: readonly P1BlockManifest[];
}

export type MutationResult =
  | { readonly ok: false; readonly reason: "tenant_denied" | "unknown_tenant" | "read_only" };

export type HiddenPayload = {
  readonly secret: string;
  readonly contextBody: string;
  readonly rawRuntimeLog: string;
};

type InternalTenant = {
  readonly id: string;
  readonly organizationName: string;
  readonly identities: readonly P1Identity[];
  readonly employees: readonly P1Employee[];
  readonly departments: readonly P1Department[];
  readonly projects: readonly P1Project[];
  readonly tasks: readonly P1Task[];
  readonly runs: readonly P1Run[];
  readonly attempts: readonly P1Attempt[];
  readonly agents: readonly P1Agent[];
  readonly runtimes: readonly P1Runtime[];
  readonly models: readonly P1Model[];
  readonly assignments: readonly P1Assignment[];
  readonly artifacts: readonly P1Artifact[];
  readonly timeline: readonly P1TimelineEvent[];
  readonly attention: readonly P1AttentionItem[];
  readonly drafts: readonly P1Draft[];
  readonly reviews: readonly P1Review[];
  readonly publishes: readonly P1Publish[];
  readonly blocks: readonly P1BlockManifest[];
  readonly hidden: HiddenPayload;
};

function freezeBlock(block: P1BlockManifest): P1BlockManifest {
  return Object.freeze({
    ...block,
    schema: Object.freeze([...block.schema]),
    scopes: Object.freeze([...block.scopes]),
    effects: Object.freeze([...block.effects]),
    evidence: Object.freeze({ ...block.evidence }),
  });
}

function motorTenant(): InternalTenant {
  const tenantId = HOME_TENANT_ID;
  const projectId = "prj-review-keten";
  const projectIdB = "prj-observatie-keten";
  const departmentId = "dep-reviewkring";
  const departmentIdB = "dep-koppelingen";
  const humanIdentityId = "id-mira";
  const aiIdentityId = "id-reviewer";
  const humanEmployeeId = "emp-mira";
  const aiEmployeeId = "emp-reviewer";
  const taskId = "task-review-samenvatting";
  const taskIdB = "task-observatie-refs";
  const runId = "run-review-1";
  const runIdB = "run-obs-1";
  const attemptId = "att-review-1";
  const attemptIdB = "atm-obs-1";
  const draftId = "draft-review-1";
  const draftIdB = "draft-obs-1";
  const reviewId = "review-review-1";
  const reviewIdB = "review-obs-1";
  const publishId = "publish-review-1";
  const publishIdB = "publish-obs-1";

  return {
    id: tenantId,
    organizationName: "De Linde (demo)",
    identities: [
      { id: humanIdentityId, tenantId, kind: "human", displayName: "Mira Vos" },
      { id: aiIdentityId, tenantId, kind: "service", displayName: "Reviewer-identiteit" },
    ],
    employees: [
      {
        id: humanEmployeeId,
        tenantId,
        identityId: humanIdentityId,
        kind: "human",
        name: "Mira Vos",
        mandate: "Goedkeuren van interne drafts; geen publicatie.",
        capabilities: ["approval.queue", "review.read"],
      },
      {
        id: aiEmployeeId,
        tenantId,
        identityId: aiIdentityId,
        kind: "ai",
        name: "Motor Reviewer",
        mandate: "Opstellen van interne review-drafts; nooit zelf publiceren.",
        capabilities: ["draft.compose", "evidence.attach"],
      },
    ],
    departments: [
      {
        id: departmentId,
        tenantId,
        name: "Reviewkring",
        purpose: "Gedeelde review-capability voor interne playbooks.",
        capabilities: ["review.draft", "approval.queue"],
      },
      {
        id: "dep-koppelingen",
        tenantId,
        name: "Koppelingen",
        purpose: "Observeerbare adapter- en evidence-koppelingen, configureerbaar per team.",
        capabilities: ["adapter.observe", "evidence.collect"],
      },
    ],
    projects: [
      {
        id: projectId,
        tenantId,
        departmentId,
        name: "Interne review-keten",
        goal: "Eén rustige keten van vraag tot uitkomst, zonder live-authority.",
        state: "jij_nodig",
        context: {
          manifestId: "ctx-review-keten",
          digest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          status: "ready",
        },
      },
      {
        id: projectIdB,
        tenantId,
        departmentId: departmentIdB,
        name: "Observatie-keten",
        goal: "Adapter-evidence zichtbaar houden zonder live-authority.",
        state: "actief",
        context: {
          manifestId: "ctx-observatie-keten",
          digest: "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
          status: "ready",
        },
      },
    ],
    tasks: [
      {
        id: taskId,
        tenantId,
        projectId,
        employeeId: aiEmployeeId,
        title: "Samenvatting van de review-vraag",
        status: "in_progress",
      },
      {
        id: taskIdB,
        tenantId,
        projectId: projectIdB,
        employeeId: aiEmployeeId,
        title: "Verzamel evidence-referenties",
        status: "assigned",
      },
    ],
    runs: [
      { id: runId, tenantId, taskId },
      { id: runIdB, tenantId, taskId: taskIdB },
    ],
    attempts: [
      { id: attemptId, tenantId, runId, outcome: "succeeded" },
      { id: attemptIdB, tenantId, runId: runIdB, outcome: "running" },
    ],
    agents: [{ id: "agent-reviewer-binding", tenantId, employeeId: aiEmployeeId, label: "Reviewer-binding" }],
    runtimes: [{ id: "rt-local-worker", tenantId, label: "local-worker-sidecar" }],
    models: [{ id: "mdl-demo-weights", tenantId, label: "demo-weights.bin" }],
    assignments: [
      { id: "asg-mira", tenantId, employeeId: humanEmployeeId, projectId, role: "Goedkeurder" },
      { id: "asg-reviewer", tenantId, employeeId: aiEmployeeId, projectId, role: "Opsteller" },
      { id: "asg-reviewer-obs", tenantId, employeeId: aiEmployeeId, projectId: projectIdB, role: "Waarnemer" },
      { id: "asg-mira-obs", tenantId, employeeId: humanEmployeeId, projectId: projectIdB, role: "Meekijker" },
    ],
    artifacts: [
      { id: "art-digest", tenantId, projectId, label: "Contextmanifest", kind: "digest" },
      { id: "art-note", tenantId, projectId, label: "Interne aantekening", kind: "note" },
      { id: "art-obs-digest", tenantId, projectId: projectIdB, label: "Observatie-digest", kind: "digest" },
      { id: "art-obs-receipt", tenantId, projectId: projectIdB, label: "Evidence-ontvangstbewijs", kind: "receipt" },
    ],
    timeline: [
      { id: "tl-1", tenantId, projectId, label: "Vraag geopend", at: "2026-08-15T08:00:00Z" },
      { id: "tl-2", tenantId, projectId, label: "Concept klaar voor review", at: "2026-08-15T09:10:00Z" },
      { id: "tl-3", tenantId, projectId, label: "Review goedgekeurd; publiceren DENY", at: "2026-08-15T10:02:00Z" },
      { id: "tl-obs-1", tenantId, projectId: projectIdB, label: "Observatie geopend", at: "2026-08-15T11:00:00Z" },
      { id: "tl-obs-2", tenantId, projectId: projectIdB, label: "Evidence-referenties verzameld", at: "2026-08-15T11:20:00Z" },
    ],
    attention: [
      {
        id: "att-vraag",
        tenantId,
        projectId,
        departmentId,
        ownerId: humanEmployeeId,
        stage: "vraag",
        kind: "approval",
        title: "Mag deze samenvatting de review in?",
        summary: "Nieuwe interne vraag, nog zonder besluit.",
        references: {
          taskId,
          runId: null,
          attemptId: null,
          approvalId: null,
          evidenceId: "ev-vraag-1",
        },
      },
      {
        id: "att-actief",
        tenantId,
        projectId,
        departmentId,
        ownerId: aiEmployeeId,
        stage: "actief",
        kind: "outcome",
        title: "Motor Reviewer schrijft het concept",
        summary: "Taak loopt; technische logs blijven buiten dit overzicht.",
        references: {
          taskId,
          runId,
          attemptId,
          approvalId: null,
          evidenceId: "ev-actief-1",
        },
      },
      {
        id: "att-failure",
        tenantId,
        projectId,
        departmentId,
        ownerId: aiEmployeeId,
        stage: "actief",
        kind: "failure",
        title: "Eén poging strandde",
        summary: "Attempt mislukt; opnieuw geprobeerd. Geen ruwe runtime-dump.",
        references: {
          taskId,
          runId: "run-review-timeout",
          attemptId: "att-review-timeout",
          approvalId: null,
          evidenceId: "ev-fail-1",
        },
      },
      {
        id: "att-jij",
        tenantId,
        projectId,
        departmentId,
        ownerId: humanEmployeeId,
        stage: "jij_nodig",
        kind: "approval",
        title: "Mira Vos: concept beoordelen",
        summary: "Review is klaar om te tekenen. Publiceren blijft gesloten.",
        references: {
          taskId,
          runId,
          attemptId,
          approvalId: "appr-mira-1",
          evidenceId: "ev-jij-1",
        },
      },
      {
        id: "att-klaar",
        tenantId,
        projectId,
        departmentId,
        ownerId: humanEmployeeId,
        stage: "klaar",
        kind: "outcome",
        title: "Concept afgerond",
        summary: "Uitkomst zichtbaar. Publish-object blijft DENY.",
        references: {
          taskId,
          runId,
          attemptId,
          approvalId: "appr-mira-1",
          evidenceId: "ev-klaar-1",
        },
      },
      {
        id: "att-obs-vraag",
        tenantId,
        projectId: projectIdB,
        departmentId: departmentIdB,
        ownerId: aiEmployeeId,
        stage: "vraag",
        kind: "approval",
        title: "Nieuwe observatie klaarzetten?",
        summary: "Alleen een leesbare vraag. Geen contextinhoud.",
        references: {
          taskId: taskIdB,
          runId: null,
          attemptId: null,
          approvalId: null,
          evidenceId: "ev-obs-vraag-1",
        },
      },
      {
        id: "att-obs-actief",
        tenantId,
        projectId: projectIdB,
        departmentId: departmentIdB,
        ownerId: aiEmployeeId,
        stage: "actief",
        kind: "outcome",
        title: "Evidence-referenties worden verzameld",
        summary: "Observatie loopt. Ruwe logs blijven buiten dit overzicht.",
        references: {
          taskId: taskIdB,
          runId: runIdB,
          attemptId: attemptIdB,
          approvalId: null,
          evidenceId: "ev-obs-actief-1",
        },
      },
      {
        id: "att-obs-jij",
        tenantId,
        projectId: projectIdB,
        departmentId: departmentIdB,
        ownerId: humanEmployeeId,
        stage: "jij_nodig",
        kind: "approval",
        title: "Mira Vos: observatie-concept beoordelen",
        summary: "Review van de observatie wacht. Publiceren blijft DENY.",
        references: {
          taskId: taskIdB,
          runId: runIdB,
          attemptId: attemptIdB,
          approvalId: "appr-mira-obs-1",
          evidenceId: "ev-obs-jij-1",
        },
      },
    ],
    drafts: [
      {
        id: draftId,
        tenantId,
        projectId,
        kind: "draft",
        state: "ready",
        bodyDigest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      },
      {
        id: draftIdB,
        tenantId,
        projectId: projectIdB,
        kind: "draft",
        state: "ready",
        title: "Observatie-concept",
        bodyDigest: "sha256:abababababababababababababababababababababababababababababababab",
      },
      {
        id: "draft-pending-1",
        tenantId,
        projectId,
        kind: "draft",
        state: "draft",
        title: "Wachtend concept",
        bodyDigest: "sha256:cdc1cdc1cdc1cdc1cdc1cdc1cdc1cdc1cdc1cdc1cdc1cdc1cdc1cdc1cdc1cdc1",
      },
      {
        id: "draft-open-1",
        tenantId,
        projectId,
        kind: "draft",
        state: "ready",
        title: "Openstaand concept",
        bodyDigest: "sha256:1cdc1cdc1cdc1cdc1cdc1cdc1cdc1cdc1cdc1cdc1cdc1cdc1cdc1cdc1cdc1cdc",
      },
    ],
    reviews: [
      {
        id: reviewId,
        tenantId,
        projectId,
        draftId,
        kind: "review",
        state: "approved",
      },
      {
        id: reviewIdB,
        tenantId,
        projectId: projectIdB,
        draftId: draftIdB,
        kind: "review",
        state: "approved",
      },
      {
        id: "review-open-1",
        tenantId,
        projectId,
        draftId: "draft-open-1",
        kind: "review",
        state: "in_review",
      },
    ],
    publishes: [
      {
        id: publishId,
        tenantId,
        projectId,
        reviewId,
        kind: "publish",
        decision: "DENY",
        reason: "P1-foundation heeft geen live-authority; publiceren blijft DENY na goedkeuring.",
        visibleAfterApproved: true,
      },
      {
        id: publishIdB,
        tenantId,
        projectId: projectIdB,
        reviewId: reviewIdB,
        kind: "publish",
        decision: "DENY",
        reason: "Observatie-keten blijft intern; publiceren is DENY na goedkeuring.",
        visibleAfterApproved: true,
      },
    ],
    blocks: [
      freezeBlock({
        id: "blk-review-compose",
        tenantId,
        name: "Review-compositie",
        schema: ["task", "context-manifest", "draft"],
        scopes: ["workspace:ws-motor", "capability:review.draft"],
        effects: [],
        risk: "low",
        evidence: {
          digest: "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
          kind: "composition",
        },
      }),
      freezeBlock({
        id: "blk-approval-gate",
        tenantId,
        name: "Goedkeuringshek",
        schema: ["review", "publish"],
        scopes: ["workspace:ws-motor", "capability:approval.queue"],
        effects: ["notify.owner"],
        risk: "medium",
        evidence: {
          digest: "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
          kind: "composition",
        },
      }),
    ],
    hidden: { ...FORBIDDEN_VIEW_MARKERS },
  };
}

function otherTenant(): InternalTenant {
  const tenantId = OTHER_TENANT_ID;
  const projectId = "prj-noordkaap-geheim";
  return {
    id: tenantId,
    organizationName: "Noordkaap Intern",
    identities: [{ id: "id-noord", tenantId, kind: "human", displayName: "Lars Holt" }],
    employees: [
      {
        id: "emp-lars",
        tenantId,
        identityId: "id-noord",
        kind: "human",
        name: "Lars Holt",
        mandate: "Alleen zichtbaar binnen Noordkaap Intern.",
        capabilities: ["review.read"],
      },
    ],
    departments: [
      {
        id: "dep-noord-archief",
        tenantId,
        name: "Archiefkring",
        purpose: "Andere tenant; mag nooit in de Motor-demo verschijnen.",
        capabilities: ["archive.read"],
      },
    ],
    projects: [
      {
        id: projectId,
        tenantId,
        departmentId: "dep-noord-archief",
        name: "Noordkaap-dossier",
        goal: "Synthetisch dossier van een andere organisatie.",
        state: "actief",
        context: {
          manifestId: "ctx-noord",
          digest: "sha256:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          status: "ready",
        },
      },
    ],
    tasks: [],
    runs: [],
    attempts: [],
    agents: [],
    runtimes: [{ id: "rt-noord-secret", tenantId, label: "noordkaap-runtime" }],
    models: [{ id: "mdl-noord-secret", tenantId, label: "noordkaap-weights" }],
    assignments: [],
    artifacts: [],
    timeline: [],
    attention: [],
    drafts: [],
    reviews: [],
    publishes: [],
    blocks: [],
    hidden: {
      secret: `${FORBIDDEN_VIEW_MARKERS.secret}-noordkaap`,
      contextBody: `${FORBIDDEN_VIEW_MARKERS.contextBody} NOORDKAAP`,
      rawRuntimeLog: `${FORBIDDEN_VIEW_MARKERS.rawRuntimeLog} noordkaap`,
    },
  };
}

const TENANTS: ReadonlyMap<string, InternalTenant> = new Map([
  [HOME_TENANT_ID, motorTenant()],
  [OTHER_TENANT_ID, otherTenant()],
]);

function tenantOrNull(tenantId: string): InternalTenant | null {
  return TENANTS.get(tenantId) ?? null;
}

export function evidenceDisplayValue(value: string | null): string {
  return value ?? "—";
}

/** Test helper: hidden internal payload, never used by the UI. */
export function peekInternalHidden(tenantId: string): HiddenPayload | null {
  return tenantOrNull(tenantId)?.hidden ?? null;
}

/** Test helper: runtime/model labels exist internally but stay out of views. */
export function internalRuntimeAndModelLabels(tenantId: string): readonly string[] {
  const tenant = tenantOrNull(tenantId);
  if (!tenant) return [];
  return [...tenant.runtimes.map((row) => row.label), ...tenant.models.map((row) => row.label)];
}

export function nowInbox(tenantId: string): NowView | null {
  const tenant = tenantOrNull(tenantId);
  if (!tenant) return null;
  return {
    stages: Object.freeze(["vraag", "actief", "jij_nodig", "klaar"] as const),
    items: tenant.attention,
  };
}

export function projectBoard(tenantId: string): readonly ProjectView[] | null {
  const tenant = tenantOrNull(tenantId);
  if (!tenant) return null;
  return tenant.projects.map((project) => ({
    project,
    team: tenant.assignments.flatMap((assignment) => {
      if (assignment.projectId !== project.id) return [];
      const employee = tenant.employees.find((row) => row.id === assignment.employeeId);
      return employee ? [{ employee, role: assignment.role }] : [];
    }),
    tasks: tenant.tasks.filter((task) => task.projectId === project.id),
    artifacts: tenant.artifacts.filter((artifact) => artifact.projectId === project.id),
    timeline: tenant.timeline.filter((event) => event.projectId === project.id),
    drafts: tenant.drafts.filter((draft) => draft.projectId === project.id),
    reviews: tenant.reviews.filter((review) => review.projectId === project.id),
    publishes: tenant.publishes.filter((publish) => publish.projectId === project.id),
  }));
}

export function departmentBoard(tenantId: string): readonly P1Department[] | null {
  const tenant = tenantOrNull(tenantId);
  return tenant ? tenant.departments : null;
}

export function rosterBoard(tenantId: string): readonly RosterEntry[] | null {
  const tenant = tenantOrNull(tenantId);
  if (!tenant) return null;
  return tenant.employees.map((employee) => {
    const identity = tenant.identities.find((row) => row.id === employee.identityId);
    if (!identity) {
      throw new Error(`employee ${employee.id} has no identity`);
    }
    return {
      identity,
      employee,
      assignments: tenant.assignments
        .filter((assignment) => assignment.employeeId === employee.id)
        .map((assignment) => {
          const project = tenant.projects.find((row) => row.id === assignment.projectId);
          return {
            projectId: assignment.projectId,
            projectName: project?.name ?? assignment.projectId,
            role: assignment.role,
          };
        }),
    };
  });
}

export function serializeFoundationView(tenantId: string): FoundationViewModel | null {
  const tenant = tenantOrNull(tenantId);
  const now = nowInbox(tenantId);
  const projects = projectBoard(tenantId);
  const departments = departmentBoard(tenantId);
  const roster = rosterBoard(tenantId);
  if (!tenant || !now || !projects || !departments || !roster) return null;
  return {
    tenantId: tenant.id,
    organizationName: tenant.organizationName,
    nav: PRIMARY_NAV,
    now,
    projects,
    departments,
    roster,
    blocks: tenant.blocks,
  };
}

export function walkNowProjectDepartment(tenantId: string): {
  readonly item: P1AttentionItem;
  readonly project: P1Project;
  readonly department: P1Department;
} | null {
  const view = serializeFoundationView(tenantId);
  if (!view) return null;
  const item = view.now.items[0];
  if (!item) return null;
  const projectView = view.projects.find((row) => row.project.id === item.projectId);
  if (!projectView) return null;
  const department = view.departments.find((row) => row.id === projectView.project.departmentId);
  if (!department) return null;
  return { item, project: projectView.project, department };
}

export function tryMutateTenant(actorTenantId: string, targetTenantId: string): MutationResult {
  if (!TENANTS.has(actorTenantId) || !TENANTS.has(targetTenantId)) {
    return { ok: false, reason: "unknown_tenant" };
  }
  if (actorTenantId !== targetTenantId) {
    return { ok: false, reason: "tenant_denied" };
  }
  return { ok: false, reason: "read_only" };
}

export function isBlockExecutable(_block: P1BlockManifest): false {
  return false;
}

export function departmentNames(tenantId: string): readonly string[] {
  return departmentBoard(tenantId)?.map((department) => department.name.toLowerCase()) ?? [];
}
