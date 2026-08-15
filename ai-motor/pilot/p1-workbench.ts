/**
 * P1.2 Motor workbench — inbox filters, tenant-scoped project open, local
 * owner/department assignment. In-memory session only. No persistence,
 * network, SQLite, Postgres or live publish.
 */

import {
  HOME_TENANT_ID,
  OTHER_TENANT_ID,
  type AttentionStage,
  type FoundationViewModel,
  type P1AttentionItem,
  type P1Department,
  type P1Draft,
  type P1Employee,
  type P1Project,
  type P1Publish,
  type P1Review,
  type ProjectView,
} from "./p1-foundation.ts";
import {
  EMPTY_OVERLAY,
  mergeShellOverlay,
  resolveMotorShell,
  type ShellOverlay,
  type ShellWriteReason,
} from "./p1-shell.ts";

export type InboxFilter = {
  readonly status?: AttentionStage | null;
  readonly departmentId?: string | null;
  readonly ownerId?: string | null;
};

export type AttentionPatch = {
  readonly attentionId: string;
  readonly tenantId: typeof HOME_TENANT_ID;
  readonly ownerId?: string;
  readonly departmentId?: string;
};

export type ProjectPatch = {
  readonly projectId: string;
  readonly tenantId: typeof HOME_TENANT_ID;
  readonly ownerEmployeeId?: string;
  readonly departmentId?: string;
};

export type WorkbenchSession = {
  readonly overlay: ShellOverlay;
  readonly attentionPatches: readonly AttentionPatch[];
  readonly projectPatches: readonly ProjectPatch[];
};

export const EMPTY_WORKBENCH_SESSION: WorkbenchSession = Object.freeze({
  overlay: EMPTY_OVERLAY,
  attentionPatches: Object.freeze([]),
  projectPatches: Object.freeze([]),
});

export type WorkbenchEvidenceRef = {
  readonly id: string;
  readonly kind: "reference" | "digest" | "receipt";
  readonly label: string;
};

export type ProjectWorkbench = {
  readonly project: P1Project;
  readonly department: P1Department | undefined;
  readonly owner: P1Employee | undefined;
  readonly tasks: ProjectView["tasks"];
  readonly artifacts: ProjectView["artifacts"];
  readonly drafts: readonly P1Draft[];
  readonly reviews: readonly P1Review[];
  readonly publishes: readonly P1Publish[];
  readonly evidence: readonly WorkbenchEvidenceRef[];
  readonly attention: readonly P1AttentionItem[];
  readonly openedFrom: P1AttentionItem | null;
};

export type WorkbenchAccess =
  | { readonly ok: true; readonly workbench: ProjectWorkbench }
  | { readonly ok: false; readonly reason: ShellWriteReason; readonly workbench: null };

export type ReassignAttentionResult =
  | { readonly ok: true; readonly patch: AttentionPatch }
  | { readonly ok: false; readonly reason: ShellWriteReason };

export type ReassignProjectResult =
  | { readonly ok: true; readonly patch: ProjectPatch }
  | { readonly ok: false; readonly reason: ShellWriteReason };

/** Local assignments live only in this session object. A reset drops them. */
export function assignmentsAreDurable(): false {
  return false;
}

export function resetWorkbenchSession(): WorkbenchSession {
  return EMPTY_WORKBENCH_SESSION;
}

function homeAccess(input: {
  readonly authenticated: boolean;
  readonly actorTenantId: string;
  readonly workspaceId: string;
}): ReturnType<typeof resolveMotorShell> {
  if (input.actorTenantId !== input.workspaceId) {
    return { ok: false, reason: "tenant_denied", view: null };
  }
  return resolveMotorShell({
    authenticated: input.authenticated,
    requested: { workspace: input.workspaceId },
  });
}

function isHomeView(view: FoundationViewModel): boolean {
  return view.tenantId === HOME_TENANT_ID;
}

function latestAttentionPatch(
  patches: readonly AttentionPatch[],
  attentionId: string,
): AttentionPatch | undefined {
  for (let i = patches.length - 1; i >= 0; i -= 1) {
    const patch = patches[i];
    if (patch && patch.tenantId === HOME_TENANT_ID && patch.attentionId === attentionId) {
      return patch;
    }
  }
  return undefined;
}

function latestProjectPatch(
  patches: readonly ProjectPatch[],
  projectId: string,
): ProjectPatch | undefined {
  for (let i = patches.length - 1; i >= 0; i -= 1) {
    const patch = patches[i];
    if (patch && patch.tenantId === HOME_TENANT_ID && patch.projectId === projectId) {
      return patch;
    }
  }
  return undefined;
}

function departmentById(
  view: FoundationViewModel,
  departmentId: string,
): P1Department | undefined {
  return view.departments.find((row) => row.id === departmentId && row.tenantId === HOME_TENANT_ID);
}

function employeeById(view: FoundationViewModel, employeeId: string): P1Employee | undefined {
  return view.roster.find((row) => row.employee.id === employeeId && row.employee.tenantId === HOME_TENANT_ID)
    ?.employee;
}

function projectOwner(row: ProjectView): P1Employee | undefined {
  const eigenaar = row.team.find((member) => member.role === "Eigenaar");
  if (eigenaar) return eigenaar.employee;
  const goedkeurder = row.team.find((member) => member.role === "Goedkeurder");
  if (goedkeurder) return goedkeurder.employee;
  const human = row.team.find((member) => member.employee.kind === "human");
  return human?.employee ?? row.team[0]?.employee;
}

function applyAttentionPatch(
  item: P1AttentionItem,
  patch: AttentionPatch | undefined,
  view: FoundationViewModel,
): P1AttentionItem {
  if (!patch || item.tenantId !== HOME_TENANT_ID) return item;
  const ownerId = patch.ownerId && employeeById(view, patch.ownerId) ? patch.ownerId : item.ownerId;
  const departmentId =
    patch.departmentId && departmentById(view, patch.departmentId) ? patch.departmentId : item.departmentId;
  if (ownerId === item.ownerId && departmentId === item.departmentId) return item;
  return { ...item, ownerId, departmentId };
}

function applyProjectPatch(row: ProjectView, patch: ProjectPatch | undefined, view: FoundationViewModel): ProjectView {
  if (!patch || row.project.tenantId !== HOME_TENANT_ID) return row;
  const departmentId =
    patch.departmentId && departmentById(view, patch.departmentId) ? patch.departmentId : row.project.departmentId;
  const owner = patch.ownerEmployeeId ? employeeById(view, patch.ownerEmployeeId) : undefined;
  const project = departmentId === row.project.departmentId ? row.project : { ...row.project, departmentId };
  if (!owner) {
    return project === row.project ? row : { ...row, project };
  }
  const team = [
    { employee: owner, role: "Eigenaar" },
    ...row.team.filter((member) => member.role !== "Eigenaar" && member.employee.id !== owner.id),
  ];
  return { ...row, project, team };
}

export function mergeWorkbenchSession(
  view: FoundationViewModel,
  session: WorkbenchSession,
): FoundationViewModel {
  if (!isHomeView(view)) return view;

  const merged = mergeShellOverlay(view, session.overlay);
  if (!isHomeView(merged)) return view;

  const projects = merged.projects.map((row) =>
    applyProjectPatch(row, latestProjectPatch(session.projectPatches, row.project.id), merged),
  );

  const items = merged.now.items
    .filter((item) => item.tenantId === HOME_TENANT_ID)
    .map((item) => applyAttentionPatch(item, latestAttentionPatch(session.attentionPatches, item.id), merged));

  return {
    ...merged,
    now: { ...merged.now, items },
    projects,
  };
}

export function filterInboxItems(
  view: FoundationViewModel,
  filter: InboxFilter = {},
): readonly P1AttentionItem[] {
  if (!isHomeView(view)) return [];
  return view.now.items.filter((item) => {
    if (item.tenantId !== HOME_TENANT_ID) return false;
    if (item.projectId === "prj-noordkaap-geheim") return false;
    if (filter.status && item.stage !== filter.status) return false;
    if (filter.departmentId && item.departmentId !== filter.departmentId) return false;
    if (filter.ownerId && item.ownerId !== filter.ownerId) return false;
    if (filter.departmentId === "dep-noord-archief") return false;
    return true;
  });
}

export function inboxFilterOptions(view: FoundationViewModel): {
  readonly statuses: readonly AttentionStage[];
  readonly departments: ReadonlyArray<{ readonly id: string; readonly name: string }>;
  readonly owners: ReadonlyArray<{ readonly id: string; readonly name: string }>;
} {
  if (!isHomeView(view)) {
    return { statuses: [], departments: [], owners: [] };
  }
  return {
    statuses: view.now.stages,
    departments: view.departments
      .filter((row) => row.tenantId === HOME_TENANT_ID)
      .map((row) => ({ id: row.id, name: row.name })),
    owners: view.roster
      .filter((row) => row.employee.tenantId === HOME_TENANT_ID)
      .map((row) => ({ id: row.employee.id, name: row.employee.name })),
  };
}

export function attentionAssignmentLabels(
  view: FoundationViewModel,
  item: P1AttentionItem,
): { readonly owner: string; readonly department: string } {
  const owner = employeeById(view, item.ownerId)?.name ?? "—";
  const department = departmentById(view, item.departmentId)?.name ?? "—";
  return { owner, department };
}

/** Fail-closed: unknown or foreign project ids never select a row. */
export function resolveClientProjectId(
  view: FoundationViewModel,
  requested: string | null | undefined,
): string | null {
  if (!requested || !isHomeView(view)) return null;
  if (requested === OTHER_TENANT_ID || requested === "prj-noordkaap-geheim") return null;
  const row = view.projects.find((item) => item.project.id === requested);
  if (!row || row.project.tenantId !== HOME_TENANT_ID) return null;
  return row.project.id;
}

function collectEvidence(row: ProjectView, attention: readonly P1AttentionItem[]): readonly WorkbenchEvidenceRef[] {
  const refs: WorkbenchEvidenceRef[] = [];
  const seen = new Set<string>();
  const push = (id: string | null, kind: WorkbenchEvidenceRef["kind"], label: string) => {
    if (!id || seen.has(id)) return;
    seen.add(id);
    refs.push({ id, kind, label });
  };
  for (const item of attention) {
    push(item.references.evidenceId, "reference", item.title);
  }
  for (const artifact of row.artifacts) {
    if (artifact.kind === "digest" || artifact.kind === "receipt") {
      push(artifact.id, artifact.kind, artifact.label);
    }
  }
  return refs;
}

export function openProjectWorkbench(input: {
  readonly authenticated: boolean;
  readonly actorTenantId: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly attentionId?: string;
  readonly view?: FoundationViewModel;
}): WorkbenchAccess {
  const access = homeAccess(input);
  if (!access.ok) return { ok: false, reason: access.reason, workbench: null };

  const view = input.view && isHomeView(input.view) ? input.view : access.view;
  const projectId = resolveClientProjectId(view, input.projectId);
  if (!projectId) return { ok: false, reason: "not_found", workbench: null };

  const row = view.projects.find((item) => item.project.id === projectId);
  if (!row) return { ok: false, reason: "not_found", workbench: null };

  const attention = view.now.items.filter(
    (item) => item.projectId === projectId && item.tenantId === HOME_TENANT_ID,
  );
  const openedFrom =
    (input.attentionId ? attention.find((item) => item.id === input.attentionId) : undefined) ?? null;

  return {
    ok: true,
    workbench: {
      project: row.project,
      department: departmentById(view, row.project.departmentId),
      owner: projectOwner(row),
      tasks: row.tasks,
      artifacts: row.artifacts,
      drafts: row.drafts,
      reviews: row.reviews,
      publishes: row.publishes,
      evidence: collectEvidence(row, attention),
      attention,
      openedFrom,
    },
  };
}

export function walkAttentionProjectConcept(
  view: FoundationViewModel,
  attentionId: string,
): {
  readonly item: P1AttentionItem;
  readonly project: P1Project;
  readonly concepts: readonly P1Draft[];
  readonly review: P1Review | undefined;
  readonly evidenceIds: readonly string[];
  readonly publish: P1Publish | undefined;
} | null {
  if (!isHomeView(view)) return null;
  const item = view.now.items.find((row) => row.id === attentionId && row.tenantId === HOME_TENANT_ID);
  if (!item) return null;
  const projectView = view.projects.find((row) => row.project.id === item.projectId);
  if (!projectView || projectView.project.tenantId !== HOME_TENANT_ID) return null;
  const opened = openProjectWorkbench({
    authenticated: true,
    actorTenantId: HOME_TENANT_ID,
    workspaceId: HOME_TENANT_ID,
    projectId: projectView.project.id,
    attentionId: item.id,
    view,
  });
  if (!opened.ok) return null;
  return {
    item,
    project: opened.workbench.project,
    concepts: opened.workbench.drafts,
    review: opened.workbench.reviews[0],
    evidenceIds: opened.workbench.evidence.map((ref) => ref.id),
    publish: opened.workbench.publishes[0],
  };
}

export function reassignAttention(input: {
  readonly authenticated: boolean;
  readonly actorTenantId: string;
  readonly workspaceId: string;
  readonly attentionId: string;
  readonly ownerId?: string;
  readonly departmentId?: string;
  readonly view?: FoundationViewModel;
}): ReassignAttentionResult {
  const access = homeAccess(input);
  if (!access.ok) return { ok: false, reason: access.reason };

  const view = input.view && isHomeView(input.view) ? input.view : access.view;
  const item = view.now.items.find((row) => row.id === input.attentionId && row.tenantId === HOME_TENANT_ID);
  if (!item) return { ok: false, reason: "not_found" };

  if (input.ownerId && !employeeById(view, input.ownerId)) return { ok: false, reason: "not_found" };
  if (input.departmentId && !departmentById(view, input.departmentId)) return { ok: false, reason: "not_found" };
  if (!input.ownerId && !input.departmentId) return { ok: false, reason: "not_found" };

  return {
    ok: true,
    patch: Object.freeze({
      attentionId: item.id,
      tenantId: HOME_TENANT_ID,
      ownerId: input.ownerId,
      departmentId: input.departmentId,
    }),
  };
}

export function reassignProject(input: {
  readonly authenticated: boolean;
  readonly actorTenantId: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly ownerEmployeeId?: string;
  readonly departmentId?: string;
  readonly view?: FoundationViewModel;
}): ReassignProjectResult {
  const access = homeAccess(input);
  if (!access.ok) return { ok: false, reason: access.reason };

  const view = input.view && isHomeView(input.view) ? input.view : access.view;
  const projectId = resolveClientProjectId(view, input.projectId);
  if (!projectId) return { ok: false, reason: "not_found" };

  if (input.ownerEmployeeId && !employeeById(view, input.ownerEmployeeId)) {
    return { ok: false, reason: "not_found" };
  }
  if (input.departmentId && !departmentById(view, input.departmentId)) {
    return { ok: false, reason: "not_found" };
  }
  if (!input.ownerEmployeeId && !input.departmentId) return { ok: false, reason: "not_found" };

  return {
    ok: true,
    patch: Object.freeze({
      projectId,
      tenantId: HOME_TENANT_ID,
      ownerEmployeeId: input.ownerEmployeeId,
      departmentId: input.departmentId,
    }),
  };
}

export function appendWorkbenchOverlay(
  session: WorkbenchSession,
  partial: Partial<ShellOverlay>,
): WorkbenchSession {
  return {
    overlay: {
      drafts: [...session.overlay.drafts, ...(partial.drafts ?? [])],
      attention: [...session.overlay.attention, ...(partial.attention ?? [])],
      departments: [...session.overlay.departments, ...(partial.departments ?? [])],
      assignments: [...session.overlay.assignments, ...(partial.assignments ?? [])],
    },
    attentionPatches: session.attentionPatches,
    projectPatches: session.projectPatches,
  };
}

export function appendAttentionPatch(session: WorkbenchSession, patch: AttentionPatch): WorkbenchSession {
  if (patch.tenantId !== HOME_TENANT_ID) return session;
  return { ...session, attentionPatches: [...session.attentionPatches, patch] };
}

export function appendProjectPatch(session: WorkbenchSession, patch: ProjectPatch): WorkbenchSession {
  if (patch.tenantId !== HOME_TENANT_ID) return session;
  return { ...session, projectPatches: [...session.projectPatches, patch] };
}
