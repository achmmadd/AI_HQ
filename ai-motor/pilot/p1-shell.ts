/**
 * P1.1 Motor shell — tenant-scoped access, typed local drafts, input-zone policy.
 *
 * In-memory read-model only. No SQLite, Postgres, network, media, telephony or
 * upload. Publish is always DENY. The UI is never the security boundary.
 */

import {
  HOME_TENANT_ID,
  LEGACY_DEPARTMENT_TAXONOMY,
  OTHER_TENANT_ID,
  type FoundationViewModel,
  type P1Assignment,
  type P1AttentionItem,
  type P1Department,
  type P1Draft,
  type P1Employee,
  type P1Project,
  type P1Publish,
  type P1Review,
  serializeFoundationView,
} from "./p1-foundation.ts";

export const MOTOR_WORKSPACE_ID = HOME_TENANT_ID;

export const INPUT_ZONE = Object.freeze([
  { id: "type", label: "Typen", enabled: true },
  { id: "speak", label: "Spreken", enabled: false },
  { id: "call", label: "Bellen", enabled: false },
  { id: "file", label: "Bestand", enabled: false },
] as const);

export type InputZoneId = (typeof INPUT_ZONE)[number]["id"];

export type ShellDenyReason =
  | "auth_required"
  | "workspace_required"
  | "unknown_workspace"
  | "tenant_denied";

export type ShellWriteReason =
  | ShellDenyReason
  | "empty_draft"
  | "not_found"
  | "placeholder_disabled"
  | "publish_denied"
  | "legacy_taxonomy";

export type RequestedScope = {
  readonly workspace?: string | null;
  readonly tenant?: string | null;
  readonly pathSegments?: readonly string[];
  readonly query?: Readonly<Record<string, string | string[] | undefined>>;
};

export type MotorAccess =
  | { readonly ok: true; readonly tenantId: typeof HOME_TENANT_ID; readonly view: FoundationViewModel }
  | { readonly ok: false; readonly reason: ShellDenyReason; readonly view: null };

export type TypedDraftResult =
  | {
      readonly ok: true;
      readonly draft: P1Draft;
      readonly attention: P1AttentionItem;
    }
  | { readonly ok: false; readonly reason: ShellWriteReason };

export type DepartmentConfigResult =
  | { readonly ok: true; readonly department: P1Department }
  | { readonly ok: false; readonly reason: ShellWriteReason };

export type AssignmentResult =
  | { readonly ok: true; readonly assignment: P1Assignment }
  | { readonly ok: false; readonly reason: ShellWriteReason };

export type PublishAttempt = {
  readonly ok: false;
  readonly decision: "DENY";
  readonly reason: ShellWriteReason;
  readonly visible: true;
};

export type ShellOverlay = {
  readonly drafts: readonly P1Draft[];
  readonly attention: readonly P1AttentionItem[];
  readonly departments: readonly P1Department[];
  readonly assignments: readonly P1Assignment[];
};

export const EMPTY_OVERLAY: ShellOverlay = Object.freeze({
  drafts: Object.freeze([]),
  attention: Object.freeze([]),
  departments: Object.freeze([]),
  assignments: Object.freeze([]),
});

function normalizeToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pushToken(into: string[], value: unknown): void {
  const token = normalizeToken(value);
  if (token) into.push(token);
  if (Array.isArray(value)) {
    for (const item of value) pushToken(into, item);
  }
}

/** Collect every workspace/tenant token from path or query. Never trust the client as authority. */
export function collectRequestedWorkspaces(scope: RequestedScope | undefined): readonly string[] {
  if (!scope) return [];
  const found: string[] = [];
  pushToken(found, scope.workspace);
  pushToken(found, scope.tenant);
  if (scope.pathSegments) {
    for (const segment of scope.pathSegments) pushToken(found, segment);
  }
  if (scope.query) {
    pushToken(found, scope.query.workspace);
    pushToken(found, scope.query.tenant);
    pushToken(found, scope.query.workspace_id);
    pushToken(found, scope.query.tenantId);
  }
  return found;
}

function deny(reason: ShellDenyReason): MotorAccess {
  return { ok: false, reason, view: null };
}

/**
 * Server-side Motor-shell access. Only `ws-motor` may receive a view.
 * Missing auth, missing workspace (unless defaulted), unknown or foreign
 * workspace fail closed and never serialize the other tenant.
 */
export function resolveMotorShell(input: {
  readonly authenticated: boolean;
  readonly requested?: RequestedScope;
  /** Page-only: bind the authenticated operator to ws-motor when no token was sent. */
  readonly defaultHomeWorkspace?: boolean;
}): MotorAccess {
  if (!input.authenticated) return deny("auth_required");

  const requested = collectRequestedWorkspaces(input.requested);
  if (requested.length === 0) {
    if (!input.defaultHomeWorkspace) return deny("workspace_required");
    const view = serializeFoundationView(HOME_TENANT_ID);
    if (!view) return deny("unknown_workspace");
    return { ok: true, tenantId: HOME_TENANT_ID, view };
  }

  const unique = [...new Set(requested)];
  if (unique.includes(OTHER_TENANT_ID)) return deny("tenant_denied");
  if (unique.some((id) => id !== HOME_TENANT_ID)) return deny("unknown_workspace");

  const view = serializeFoundationView(HOME_TENANT_ID);
  if (!view) return deny("unknown_workspace");
  return { ok: true, tenantId: HOME_TENANT_ID, view };
}

function authorizeHomeWrite(input: {
  readonly authenticated: boolean;
  readonly actorTenantId: string;
  readonly workspaceId: string;
}): MotorAccess {
  if (!input.authenticated) return deny("auth_required");
  if (!normalizeToken(input.workspaceId) || !normalizeToken(input.actorTenantId)) {
    return deny("workspace_required");
  }
  if (input.actorTenantId !== input.workspaceId) return deny("tenant_denied");
  return resolveMotorShell({
    authenticated: true,
    requested: { workspace: input.workspaceId },
  });
}

function syntheticDigest(text: string): string {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0").repeat(8).slice(0, 64);
  return `sha256:${hex}`;
}

/** Typen may prepare a local draft. Never a publish object. */
export function prepareTypedDraft(input: {
  readonly authenticated: boolean;
  readonly actorTenantId: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly title: string;
  readonly body?: string;
  readonly nonce?: string;
}): TypedDraftResult {
  const access = authorizeHomeWrite(input);
  if (!access.ok) return { ok: false, reason: access.reason };

  const title = input.title.trim();
  if (!title) return { ok: false, reason: "empty_draft" };

  const project = access.view.projects.find((row) => row.project.id === input.projectId);
  if (!project) return { ok: false, reason: "not_found" };

  const material = `${title}\n${input.body ?? ""}\n${input.nonce ?? ""}`;
  const id = `draft-typed-${syntheticDigest(material).slice(7, 19)}`;
  const draft: P1Draft = Object.freeze({
    id,
    tenantId: HOME_TENANT_ID,
    projectId: project.project.id,
    kind: "draft",
    state: "draft",
    origin: "typed",
    title,
    bodyDigest: syntheticDigest(material),
  });
  const attention: P1AttentionItem = Object.freeze({
    id: `att-${id}`,
    tenantId: HOME_TENANT_ID,
    projectId: project.project.id,
    stage: "vraag",
    kind: "approval",
    title,
    summary: "Lokaal concept (draft). Publiceren blijft DENY.",
    references: Object.freeze({
      taskId: null,
      runId: null,
      attemptId: null,
      approvalId: null,
      evidenceId: null,
    }),
  });
  return { ok: true, draft, attention };
}

export function activateInput(id: InputZoneId): { readonly ok: true } | { readonly ok: false; readonly reason: "placeholder_disabled" } {
  const action = INPUT_ZONE.find((item) => item.id === id);
  if (action?.enabled) return { ok: true };
  return { ok: false, reason: "placeholder_disabled" };
}

/** Visible and technical DENY, including after an approved review and for new drafts. */
export function tryPublish(input: {
  readonly authenticated: boolean;
  readonly actorTenantId: string;
  readonly workspaceId: string;
  readonly draftId?: string;
  readonly reviewId?: string;
}): PublishAttempt {
  const access = authorizeHomeWrite(input);
  if (!access.ok) {
    return { ok: false, decision: "DENY", reason: access.reason, visible: true };
  }
  return {
    ok: false,
    decision: "DENY",
    reason: "publish_denied",
    visible: true,
  };
}

export function configureDepartment(input: {
  readonly authenticated: boolean;
  readonly actorTenantId: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly purpose: string;
  readonly capabilities: readonly string[];
  readonly nonce?: string;
}): DepartmentConfigResult {
  const access = authorizeHomeWrite(input);
  if (!access.ok) return { ok: false, reason: access.reason };

  const name = input.name.trim();
  const purpose = input.purpose.trim();
  const capabilities = input.capabilities.map((item) => item.trim()).filter(Boolean);
  if (!name || !purpose || capabilities.length === 0) return { ok: false, reason: "not_found" };
  if ((LEGACY_DEPARTMENT_TAXONOMY as readonly string[]).includes(name.toLowerCase())) {
    return { ok: false, reason: "legacy_taxonomy" };
  }

  const department: P1Department = Object.freeze({
    id: `dep-typed-${syntheticDigest(`${name}:${input.nonce ?? ""}`).slice(7, 19)}`,
    tenantId: HOME_TENANT_ID,
    name,
    purpose,
    capabilities: Object.freeze([...capabilities]),
  });
  return { ok: true, department };
}

export function assignEmployee(input: {
  readonly authenticated: boolean;
  readonly actorTenantId: string;
  readonly workspaceId: string;
  readonly employeeId: string;
  readonly projectId: string;
  readonly role: string;
  readonly nonce?: string;
}): AssignmentResult {
  const access = authorizeHomeWrite(input);
  if (!access.ok) return { ok: false, reason: access.reason };

  const role = input.role.trim();
  if (!role) return { ok: false, reason: "not_found" };

  const employee = access.view.roster.find((row) => row.employee.id === input.employeeId);
  const project = access.view.projects.find((row) => row.project.id === input.projectId);
  if (!employee || !project) return { ok: false, reason: "not_found" };

  const assignment: P1Assignment = Object.freeze({
    id: `asg-typed-${syntheticDigest(`${input.employeeId}:${input.projectId}:${role}:${input.nonce ?? ""}`).slice(7, 19)}`,
    tenantId: HOME_TENANT_ID,
    employeeId: employee.employee.id,
    projectId: project.project.id,
    role,
  });
  return { ok: true, assignment };
}

function employeeById(view: FoundationViewModel, employeeId: string): P1Employee | undefined {
  return view.roster.find((row) => row.employee.id === employeeId)?.employee;
}

export function mergeShellOverlay(view: FoundationViewModel, overlay: ShellOverlay): FoundationViewModel {
  if (view.tenantId !== HOME_TENANT_ID) {
    return view;
  }

  const draftsByProject = new Map<string, P1Draft[]>();
  for (const draft of overlay.drafts) {
    if (draft.tenantId !== HOME_TENANT_ID) continue;
    const list = draftsByProject.get(draft.projectId) ?? [];
    list.push(draft);
    draftsByProject.set(draft.projectId, list);
  }

  const assignmentsByProject = new Map<string, P1Assignment[]>();
  const assignmentsByEmployee = new Map<string, P1Assignment[]>();
  for (const assignment of overlay.assignments) {
    if (assignment.tenantId !== HOME_TENANT_ID) continue;
    const byProject = assignmentsByProject.get(assignment.projectId) ?? [];
    byProject.push(assignment);
    assignmentsByProject.set(assignment.projectId, byProject);
    const byEmployee = assignmentsByEmployee.get(assignment.employeeId) ?? [];
    byEmployee.push(assignment);
    assignmentsByEmployee.set(assignment.employeeId, byEmployee);
  }

  const projects = view.projects.map((row) => {
    const extraDrafts = draftsByProject.get(row.project.id) ?? [];
    const extraAssignments = assignmentsByProject.get(row.project.id) ?? [];
    const extraTeam = extraAssignments.flatMap((assignment) => {
      const employee = employeeById(view, assignment.employeeId);
      return employee ? [{ employee, role: assignment.role }] : [];
    });
    return {
      ...row,
      drafts: [...row.drafts, ...extraDrafts],
      team: [...row.team, ...extraTeam],
    };
  });

  const projectName = (projectId: string, fallback: P1Project["name"] | string) => {
    const match = projects.find((row) => row.project.id === projectId);
    return match?.project.name ?? fallback;
  };

  return {
    ...view,
    now: {
      ...view.now,
      items: [...overlay.attention.filter((item) => item.tenantId === HOME_TENANT_ID), ...view.now.items],
    },
    projects,
    departments: [
      ...view.departments,
      ...overlay.departments.filter((department) => department.tenantId === HOME_TENANT_ID),
    ],
    roster: view.roster.map((entry) => {
      const extra = assignmentsByEmployee.get(entry.employee.id) ?? [];
      if (extra.length === 0) return entry;
      return {
        ...entry,
        assignments: [
          ...entry.assignments,
          ...extra.map((assignment) => ({
            projectId: assignment.projectId,
            projectName: projectName(assignment.projectId, assignment.projectId),
            role: assignment.role,
          })),
        ],
      };
    }),
  };
}

export function walkNowProjectConceptReview(view: FoundationViewModel): {
  readonly item: P1AttentionItem;
  readonly project: P1Project;
  readonly concepts: readonly P1Draft[];
  readonly review: P1Review | undefined;
  readonly publish: P1Publish | undefined;
} | null {
  const item = view.now.items[0];
  if (!item) return null;
  const projectView = view.projects.find((row) => row.project.id === item.projectId);
  if (!projectView) return null;
  return {
    item,
    project: projectView.project,
    concepts: projectView.drafts,
    review: projectView.reviews[0],
    publish: projectView.publishes[0],
  };
}

export function allPublishDecisions(view: FoundationViewModel): readonly P1Publish[] {
  return view.projects.flatMap((row) => row.publishes);
}

export function viewContainsForeignTenant(view: FoundationViewModel): boolean {
  const blob = JSON.stringify(view);
  return (
    view.tenantId !== HOME_TENANT_ID ||
    blob.includes(OTHER_TENANT_ID) ||
    blob.includes("Noordkaap") ||
    blob.includes("prj-noordkaap-geheim")
  );
}
