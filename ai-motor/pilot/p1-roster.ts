/**
 * P1.3 Departments + Roster workbench — list/detail, Human vs AI roster,
 * in-memory employee ↔ department ↔ project assignment. Session only.
 * No persistence, network, SQLite, Postgres or live publish.
 */

import {
  HOME_TENANT_ID,
  LEGACY_DEPARTMENT_TAXONOMY,
  OTHER_TENANT_ID,
  type FoundationViewModel,
  type P1Department,
  type P1Employee,
  type P1Identity,
  type P1Project,
  type P1Publish,
  type RosterEntry,
} from "./p1-foundation.ts";
import {
  assignEmployee,
  configureDepartment,
  EMPTY_OVERLAY,
  resolveMotorShell,
  type AssignmentResult,
  type DepartmentConfigResult,
  type ShellOverlay,
  type ShellWriteReason,
} from "./p1-shell.ts";
import {
  EMPTY_WORKBENCH_SESSION,
  mergeWorkbenchSession,
  type AttentionPatch,
  type ProjectPatch,
  type WorkbenchSession,
} from "./p1-workbench.ts";

export type DepartmentPatch = {
  readonly departmentId: string;
  readonly tenantId: typeof HOME_TENANT_ID;
  readonly name?: string;
  readonly purpose?: string;
  readonly capabilities?: readonly string[];
};

export type MembershipPatch = {
  readonly employeeId: string;
  readonly departmentId: string;
  readonly tenantId: typeof HOME_TENANT_ID;
  readonly role: string;
};

export type RosterSession = {
  readonly overlay: ShellOverlay;
  readonly attentionPatches: readonly AttentionPatch[];
  readonly projectPatches: readonly ProjectPatch[];
  readonly departmentPatches: readonly DepartmentPatch[];
  readonly membershipPatches: readonly MembershipPatch[];
};

export const EMPTY_ROSTER_SESSION: RosterSession = Object.freeze({
  overlay: EMPTY_OVERLAY,
  attentionPatches: EMPTY_WORKBENCH_SESSION.attentionPatches,
  projectPatches: EMPTY_WORKBENCH_SESSION.projectPatches,
  departmentPatches: Object.freeze([]),
  membershipPatches: Object.freeze([]),
});

export type DepartmentMember = {
  readonly employee: P1Employee;
  readonly identity: P1Identity;
  readonly role: string;
};

export type DepartmentLink = {
  readonly departmentId: string;
  readonly departmentName: string;
  readonly role: string;
};

export type RosterWorkbenchEntry = {
  readonly identity: P1Identity;
  readonly employee: P1Employee;
  readonly departments: readonly DepartmentLink[];
  readonly assignments: RosterEntry["assignments"];
};

export type DepartmentWorkbench = {
  readonly department: P1Department;
  readonly members: readonly DepartmentMember[];
  readonly projects: readonly P1Project[];
  readonly publishes: readonly P1Publish[];
};

export type DepartmentAccess =
  | { readonly ok: true; readonly workbench: DepartmentWorkbench }
  | { readonly ok: false; readonly reason: ShellWriteReason; readonly workbench: null };

export type DepartmentUpdateResult =
  | { readonly ok: true; readonly patch: DepartmentPatch }
  | { readonly ok: false; readonly reason: ShellWriteReason };

export type MembershipResult =
  | { readonly ok: true; readonly patch: MembershipPatch }
  | { readonly ok: false; readonly reason: ShellWriteReason };

export type SplitRoster = {
  readonly humans: readonly RosterEntry[];
  readonly ai: readonly RosterEntry[];
};

/** Local roster/department state lives only in this session object. */
export function rosterStateIsDurable(): false {
  return false;
}

export function resetRosterSession(): RosterSession {
  return EMPTY_ROSTER_SESSION;
}

export function asWorkbenchSession(session: RosterSession): WorkbenchSession {
  return {
    overlay: session.overlay,
    attentionPatches: session.attentionPatches,
    projectPatches: session.projectPatches,
  };
}

export function withWorkbenchUpdate(session: RosterSession, next: WorkbenchSession): RosterSession {
  return {
    ...session,
    overlay: next.overlay,
    attentionPatches: next.attentionPatches,
    projectPatches: next.projectPatches,
  };
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

function isLegacyName(name: string): boolean {
  return (LEGACY_DEPARTMENT_TAXONOMY as readonly string[]).includes(name.trim().toLowerCase());
}

function latestDepartmentPatch(
  patches: readonly DepartmentPatch[],
  departmentId: string,
): DepartmentPatch | undefined {
  for (let i = patches.length - 1; i >= 0; i -= 1) {
    const patch = patches[i];
    if (patch && patch.tenantId === HOME_TENANT_ID && patch.departmentId === departmentId) {
      return patch;
    }
  }
  return undefined;
}

function applyDepartmentPatch(department: P1Department, patch: DepartmentPatch | undefined): P1Department {
  if (!patch || department.tenantId !== HOME_TENANT_ID) return department;
  const name = patch.name?.trim() || department.name;
  if (isLegacyName(name)) return department;
  const purpose = patch.purpose?.trim() || department.purpose;
  const capabilities =
    patch.capabilities && patch.capabilities.length > 0 ? patch.capabilities : department.capabilities;
  if (name === department.name && purpose === department.purpose && capabilities === department.capabilities) {
    return department;
  }
  return { ...department, name, purpose, capabilities: Object.freeze([...capabilities]) };
}

export function parseCapabilities(text: string): readonly string[] {
  return text
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function mergeRosterSession(view: FoundationViewModel, session: RosterSession): FoundationViewModel {
  const merged = mergeWorkbenchSession(view, asWorkbenchSession(session));
  if (!isHomeView(merged)) return view;

  const departments = merged.departments.map((department) =>
    applyDepartmentPatch(department, latestDepartmentPatch(session.departmentPatches, department.id)),
  );

  return { ...merged, departments };
}

export function appendRosterOverlay(session: RosterSession, partial: Partial<ShellOverlay>): RosterSession {
  return {
    ...session,
    overlay: {
      drafts: [...session.overlay.drafts, ...(partial.drafts ?? [])],
      attention: [...session.overlay.attention, ...(partial.attention ?? [])],
      departments: [...session.overlay.departments, ...(partial.departments ?? [])],
      assignments: [...session.overlay.assignments, ...(partial.assignments ?? [])],
    },
  };
}

export function appendDepartmentPatch(session: RosterSession, patch: DepartmentPatch): RosterSession {
  if (patch.tenantId !== HOME_TENANT_ID) return session;
  return { ...session, departmentPatches: [...session.departmentPatches, patch] };
}

export function appendMembershipPatch(session: RosterSession, patch: MembershipPatch): RosterSession {
  if (patch.tenantId !== HOME_TENANT_ID) return session;
  return { ...session, membershipPatches: [...session.membershipPatches, patch] };
}

function departmentById(view: FoundationViewModel, departmentId: string): P1Department | undefined {
  return view.departments.find((row) => row.id === departmentId && row.tenantId === HOME_TENANT_ID);
}

function rosterEntryById(view: FoundationViewModel, employeeId: string): RosterEntry | undefined {
  return view.roster.find((row) => row.employee.id === employeeId && row.employee.tenantId === HOME_TENANT_ID);
}

/** Fail-closed: unknown or foreign department ids never select a row. */
export function resolveClientDepartmentId(
  view: FoundationViewModel,
  requested: string | null | undefined,
): string | null {
  if (!requested || !isHomeView(view)) return null;
  if (requested === OTHER_TENANT_ID || requested === "dep-noord-archief") return null;
  const row = departmentById(view, requested);
  return row ? row.id : null;
}

/** Fail-closed: unknown or foreign employee ids never select a row. */
export function resolveClientEmployeeId(
  view: FoundationViewModel,
  requested: string | null | undefined,
): string | null {
  if (!requested || !isHomeView(view)) return null;
  if (requested === OTHER_TENANT_ID || requested === "emp-lars") return null;
  const row = rosterEntryById(view, requested);
  return row ? row.employee.id : null;
}

export function splitRoster(view: FoundationViewModel): SplitRoster {
  if (!isHomeView(view)) return { humans: [], ai: [] };
  return {
    humans: view.roster.filter((row) => row.employee.kind === "human" && row.employee.tenantId === HOME_TENANT_ID),
    ai: view.roster.filter((row) => row.employee.kind === "ai" && row.employee.tenantId === HOME_TENANT_ID),
  };
}

function seedDepartmentLinks(view: FoundationViewModel, entry: RosterEntry): DepartmentLink[] {
  const links: DepartmentLink[] = [];
  const seen = new Set<string>();
  for (const assignment of entry.assignments) {
    const project = view.projects.find((row) => row.project.id === assignment.projectId);
    if (!project || project.project.tenantId !== HOME_TENANT_ID) continue;
    const department = departmentById(view, project.project.departmentId);
    if (!department || seen.has(department.id)) continue;
    seen.add(department.id);
    links.push({
      departmentId: department.id,
      departmentName: department.name,
      role: assignment.role,
    });
  }
  return links;
}

function membershipLinks(
  view: FoundationViewModel,
  session: RosterSession,
  employeeId: string,
): DepartmentLink[] {
  const links: DepartmentLink[] = [];
  const seen = new Set<string>();
  for (let i = session.membershipPatches.length - 1; i >= 0; i -= 1) {
    const patch = session.membershipPatches[i];
    if (!patch || patch.tenantId !== HOME_TENANT_ID || patch.employeeId !== employeeId) continue;
    if (seen.has(patch.departmentId)) continue;
    const department = departmentById(view, patch.departmentId);
    if (!department) continue;
    seen.add(patch.departmentId);
    links.push({
      departmentId: department.id,
      departmentName: department.name,
      role: patch.role,
    });
  }
  return links;
}

export function rosterWorkbenchEntries(
  view: FoundationViewModel,
  session: RosterSession = EMPTY_ROSTER_SESSION,
): readonly RosterWorkbenchEntry[] {
  if (!isHomeView(view)) return [];
  return view.roster
    .filter((row) => row.employee.tenantId === HOME_TENANT_ID)
    .map((entry) => {
      const extras = membershipLinks(view, session, entry.employee.id);
      const seed = seedDepartmentLinks(view, entry);
      const seen = new Set(extras.map((link) => link.departmentId));
      return {
        identity: entry.identity,
        employee: entry.employee,
        departments: [...extras, ...seed.filter((link) => !seen.has(link.departmentId))],
        assignments: entry.assignments,
      };
    });
}

function membersForDepartment(
  view: FoundationViewModel,
  session: RosterSession,
  departmentId: string,
): readonly DepartmentMember[] {
  const members: DepartmentMember[] = [];
  const seen = new Set<string>();

  for (let i = session.membershipPatches.length - 1; i >= 0; i -= 1) {
    const patch = session.membershipPatches[i];
    if (!patch || patch.tenantId !== HOME_TENANT_ID || patch.departmentId !== departmentId) continue;
    if (seen.has(patch.employeeId)) continue;
    const entry = rosterEntryById(view, patch.employeeId);
    if (!entry) continue;
    seen.add(patch.employeeId);
    members.push({ employee: entry.employee, identity: entry.identity, role: patch.role });
  }

  for (const row of view.projects) {
    if (row.project.departmentId !== departmentId || row.project.tenantId !== HOME_TENANT_ID) continue;
    for (const member of row.team) {
      if (seen.has(member.employee.id) || member.employee.tenantId !== HOME_TENANT_ID) continue;
      const entry = rosterEntryById(view, member.employee.id);
      if (!entry) continue;
      seen.add(member.employee.id);
      members.push({ employee: entry.employee, identity: entry.identity, role: member.role });
    }
  }

  return members;
}

export function openDepartmentWorkbench(input: {
  readonly authenticated: boolean;
  readonly actorTenantId: string;
  readonly workspaceId: string;
  readonly departmentId: string;
  readonly view?: FoundationViewModel;
  readonly session?: RosterSession;
}): DepartmentAccess {
  const access = homeAccess(input);
  if (!access.ok) return { ok: false, reason: access.reason, workbench: null };

  const view = input.view && isHomeView(input.view) ? input.view : access.view;
  const departmentId = resolveClientDepartmentId(view, input.departmentId);
  if (!departmentId) return { ok: false, reason: "not_found", workbench: null };

  const department = departmentById(view, departmentId);
  if (!department) return { ok: false, reason: "not_found", workbench: null };

  const projectRows = view.projects.filter(
    (row) => row.project.departmentId === departmentId && row.project.tenantId === HOME_TENANT_ID,
  );
  const session = input.session ?? EMPTY_ROSTER_SESSION;

  return {
    ok: true,
    workbench: {
      department,
      members: membersForDepartment(view, session, departmentId),
      projects: projectRows.map((row) => row.project),
      publishes: projectRows.flatMap((row) => row.publishes),
    },
  };
}

export function createDepartment(input: {
  readonly authenticated: boolean;
  readonly actorTenantId: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly purpose: string;
  readonly capabilities: readonly string[];
  readonly nonce?: string;
}): DepartmentConfigResult {
  return configureDepartment(input);
}

export function updateDepartment(input: {
  readonly authenticated: boolean;
  readonly actorTenantId: string;
  readonly workspaceId: string;
  readonly departmentId: string;
  readonly name?: string;
  readonly purpose?: string;
  readonly capabilities?: readonly string[];
  readonly view?: FoundationViewModel;
}): DepartmentUpdateResult {
  const access = homeAccess(input);
  if (!access.ok) return { ok: false, reason: access.reason };

  const view = input.view && isHomeView(input.view) ? input.view : access.view;
  const departmentId = resolveClientDepartmentId(view, input.departmentId);
  if (!departmentId) return { ok: false, reason: "not_found" };

  const name = input.name?.trim();
  const purpose = input.purpose?.trim();
  const capabilities = input.capabilities?.map((item) => item.trim()).filter(Boolean);
  if (!name && !purpose && (!capabilities || capabilities.length === 0)) {
    return { ok: false, reason: "not_found" };
  }
  if (name && isLegacyName(name)) return { ok: false, reason: "legacy_taxonomy" };

  return {
    ok: true,
    patch: Object.freeze({
      departmentId,
      tenantId: HOME_TENANT_ID,
      name,
      purpose,
      capabilities: capabilities ? Object.freeze([...capabilities]) : undefined,
    }),
  };
}

export function assignToDepartment(input: {
  readonly authenticated: boolean;
  readonly actorTenantId: string;
  readonly workspaceId: string;
  readonly employeeId: string;
  readonly departmentId: string;
  readonly role: string;
  readonly view?: FoundationViewModel;
}): MembershipResult {
  const access = homeAccess(input);
  if (!access.ok) return { ok: false, reason: access.reason };

  const view = input.view && isHomeView(input.view) ? input.view : access.view;
  const employeeId = resolveClientEmployeeId(view, input.employeeId);
  const departmentId = resolveClientDepartmentId(view, input.departmentId);
  const role = input.role.trim();
  if (!employeeId || !departmentId || !role) return { ok: false, reason: "not_found" };

  return {
    ok: true,
    patch: Object.freeze({
      employeeId,
      departmentId,
      tenantId: HOME_TENANT_ID,
      role,
    }),
  };
}

export function assignToProject(input: {
  readonly authenticated: boolean;
  readonly actorTenantId: string;
  readonly workspaceId: string;
  readonly employeeId: string;
  readonly projectId: string;
  readonly role: string;
  readonly nonce?: string;
}): AssignmentResult {
  return assignEmployee(input);
}

export function rosterConcepts(entry: RosterEntry | RosterWorkbenchEntry): {
  readonly identityId: string;
  readonly employeeId: string;
  readonly identityKind: P1Identity["kind"];
  readonly employeeKind: P1Employee["kind"];
  readonly hasAgent: boolean;
  readonly hasRuntime: boolean;
  readonly hasModel: boolean;
} {
  const record = entry as Record<string, unknown>;
  const employee = entry.employee as P1Employee & Record<string, unknown>;
  return {
    identityId: entry.identity.id,
    employeeId: entry.employee.id,
    identityKind: entry.identity.kind,
    employeeKind: entry.employee.kind,
    hasAgent: "agentId" in record || "agentId" in employee,
    hasRuntime: "runtimeId" in record || "runtimeId" in employee,
    hasModel: "modelId" in record || "modelId" in employee,
  };
}
