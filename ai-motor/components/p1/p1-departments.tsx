"use client";

import { useState, type FormEvent } from "react";
import { Bot, User } from "lucide-react";
import type { FoundationViewModel } from "@/pilot/p1-foundation";
import {
  assignToDepartment,
  assignToProject,
  createDepartment,
  openDepartmentWorkbench,
  parseCapabilities,
  resolveClientDepartmentId,
  resolveClientEmployeeId,
  rosterWorkbenchEntries,
  splitRoster,
  updateDepartment,
  type DepartmentPatch,
  type MembershipPatch,
  type RosterSession,
} from "@/pilot/p1-roster";
import type { ShellOverlay } from "@/pilot/p1-shell";
import {
  P1Badge,
  P1Button,
  P1Card,
  P1CardContent,
  P1CardDescription,
  P1CardHeader,
  P1CardTitle,
  P1Select,
  P1Textarea,
} from "@/components/p1/ui";

function kindLabel(kind: "human" | "ai"): string {
  return kind === "human" ? "Mens" : "AI Employee";
}

export function P1Departments({
  view,
  session,
  onOverlay,
  onDepartmentPatch,
  onMembershipPatch,
}: {
  view: FoundationViewModel;
  session: RosterSession;
  onOverlay: (partial: Partial<ShellOverlay>) => void;
  onDepartmentPatch: (patch: DepartmentPatch) => void;
  onMembershipPatch: (patch: MembershipPatch) => void;
}) {
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const departmentId = resolveClientDepartmentId(view, selectedDepartmentId);
  const employeeId = resolveClientEmployeeId(view, selectedEmployeeId);

  if (departmentId) {
    return (
      <DepartmentDetail
        view={view}
        session={session}
        departmentId={departmentId}
        onBack={() => setSelectedDepartmentId(null)}
        onOverlay={onOverlay}
        onDepartmentPatch={onDepartmentPatch}
        onMembershipPatch={onMembershipPatch}
      />
    );
  }

  if (employeeId) {
    return (
      <RosterDetail
        view={view}
        session={session}
        employeeId={employeeId}
        onBack={() => setSelectedEmployeeId(null)}
        onOverlay={onOverlay}
        onMembershipPatch={onMembershipPatch}
      />
    );
  }

  return (
    <DepartmentsOverview
      view={view}
      session={session}
      onOpenDepartment={setSelectedDepartmentId}
      onOpenEmployee={setSelectedEmployeeId}
      onOverlay={onOverlay}
    />
  );
}

function DepartmentsOverview({
  view,
  session,
  onOpenDepartment,
  onOpenEmployee,
  onOverlay,
}: {
  view: FoundationViewModel;
  session: RosterSession;
  onOpenDepartment: (id: string) => void;
  onOpenEmployee: (id: string) => void;
  onOverlay: (partial: Partial<ShellOverlay>) => void;
}) {
  const split = splitRoster(view);
  const [deptName, setDeptName] = useState("");
  const [deptPurpose, setDeptPurpose] = useState("");
  const [deptCapabilities, setDeptCapabilities] = useState("team.configure");
  const [role, setRole] = useState("Meekijker");
  const [employeeId, setEmployeeId] = useState(view.roster[0]?.employee.id ?? "");
  const [projectId, setProjectId] = useState(view.projects[0]?.project.id ?? "");
  const [notice, setNotice] = useState<string | null>(null);

  function addDepartment(event: FormEvent) {
    event.preventDefault();
    const result = createDepartment({
      authenticated: true,
      actorTenantId: view.tenantId,
      workspaceId: view.tenantId,
      name: deptName,
      purpose: deptPurpose,
      capabilities: parseCapabilities(deptCapabilities),
      nonce: `${Date.now()}`,
    });
    if (!result.ok) {
      setNotice(result.reason === "legacy_taxonomy" ? "Geen vaste legacy-taxonomie." : "Afdeling kon niet worden toegevoegd.");
      return;
    }
    onOverlay({ departments: [result.department], assignments: [] });
    setDeptName("");
    setDeptPurpose("");
    setNotice("Afdeling lokaal toegevoegd binnen deze tenant.");
  }

  function addAssignment(event: FormEvent) {
    event.preventDefault();
    if (!projectId || !employeeId) {
      setNotice("Kies een medewerker en project.");
      return;
    }
    const result = assignToProject({
      authenticated: true,
      actorTenantId: view.tenantId,
      workspaceId: view.tenantId,
      employeeId,
      projectId,
      role,
      nonce: `${Date.now()}`,
    });
    if (!result.ok) {
      setNotice("Toewijzing kon niet worden gemaakt.");
      return;
    }
    onOverlay({ departments: [], assignments: [result.assignment] });
    setNotice("Toewijzing lokaal toegevoegd. Dit verdwijnt bij herstel of herladen.");
  }

  return (
    <section className="space-y-6" aria-labelledby="departments-heading">
      <header>
        <p className="text-sm font-medium text-accent">Gedeelde structuur</p>
        <h1 id="departments-heading" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Afdelingen
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Lijst en detail. Configureerbare naam, doel en capabilities. Human en AI Employee blijven
          aparte Employees. Geen vaste legacy-taxonomie.
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {view.departments.map((department) => (
          <P1Card key={department.id}>
            <P1CardHeader>
              <div className="flex justify-between gap-3">
                <P1CardTitle>{department.name}</P1CardTitle>
                <P1Badge variant="outline">Configureerbaar</P1Badge>
              </div>
              <P1CardDescription>{department.purpose}</P1CardDescription>
            </P1CardHeader>
            <P1CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {department.capabilities.map((capability) => (
                  <P1Badge key={capability} variant="secondary">
                    {capability}
                  </P1Badge>
                ))}
              </div>
              <P1Button variant="outline" onClick={() => onOpenDepartment(department.id)}>
                Open afdeling
              </P1Button>
            </P1CardContent>
          </P1Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <RosterColumn
          title="Human"
          description="Menselijke Employee. Identiteit is niet de Employee, en geen Agent, Runtime of Model."
          icon={User}
          entries={split.humans}
          session={session}
          view={view}
          onOpen={onOpenEmployee}
        />
        <RosterColumn
          title="AI Employee"
          description="AI Employee. Identiteit is niet de Employee, en geen Agent, Runtime of Model."
          icon={Bot}
          entries={split.ai}
          session={session}
          view={view}
          onOpen={onOpenEmployee}
        />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Nieuwe afdeling</P1CardTitle>
            <P1CardDescription>Alleen binnen deze tenant, lokaal in het read-model.</P1CardDescription>
          </P1CardHeader>
          <P1CardContent>
            <form className="space-y-3" onSubmit={addDepartment}>
              <input
                value={deptName}
                onChange={(event) => setDeptName(event.target.value)}
                placeholder="Naam"
                className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
              <P1Textarea
                value={deptPurpose}
                onChange={(event) => setDeptPurpose(event.target.value)}
                placeholder="Doel van deze afdeling"
              />
              <input
                value={deptCapabilities}
                onChange={(event) => setDeptCapabilities(event.target.value)}
                placeholder="Capabilities, gescheiden door komma"
                className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
              <P1Button type="submit">Voeg afdeling toe</P1Button>
            </form>
          </P1CardContent>
        </P1Card>
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Toewijzing</P1CardTitle>
            <P1CardDescription>Medewerker koppelen aan een project in deze werkruimte.</P1CardDescription>
          </P1CardHeader>
          <P1CardContent>
            <form className="space-y-3" onSubmit={addAssignment}>
              <P1Select value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
                {view.roster.map((entry) => (
                  <option key={entry.employee.id} value={entry.employee.id}>
                    {entry.employee.name} · {kindLabel(entry.employee.kind)}
                  </option>
                ))}
              </P1Select>
              <P1Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                {view.projects.map((row) => (
                  <option key={row.project.id} value={row.project.id}>
                    {row.project.name}
                  </option>
                ))}
              </P1Select>
              <input
                value={role}
                onChange={(event) => setRole(event.target.value)}
                placeholder="Rol"
                className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
              <P1Button type="submit">Wijs toe</P1Button>
            </form>
          </P1CardContent>
        </P1Card>
      </div>
      <P1Card>
        <P1CardHeader>
          <P1CardTitle>Typed BlockManifest</P1CardTitle>
          <P1CardDescription>
            Blocks zijn compositie-data. Ze voeren niets uit, zijn geen SSOT en hebben geen authority.
          </P1CardDescription>
        </P1CardHeader>
        <P1CardContent className="space-y-3">
          {view.blocks.map((block) => (
            <div key={block.id} className="rounded-lg border border-border p-4">
              <div className="flex justify-between gap-3">
                <p className="text-sm font-medium">{block.name}</p>
                <P1Badge variant="secondary">{block.risk}</P1Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Schema</dt>
                  <dd>{block.schema.join(", ")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Scopes</dt>
                  <dd>{block.scopes.join(", ")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Effects</dt>
                  <dd>{block.effects.length ? block.effects.join(", ") : "Geen"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Uitvoerbaar</dt>
                  <dd>Nee</dd>
                </div>
              </dl>
            </div>
          ))}
        </P1CardContent>
      </P1Card>
      {notice ? <p className="text-xs text-muted-foreground">{notice}</p> : null}
    </section>
  );
}

function RosterColumn({
  title,
  description,
  icon: Icon,
  entries,
  session,
  view,
  onOpen,
}: {
  title: string;
  description: string;
  icon: typeof User;
  entries: ReturnType<typeof splitRoster>["humans"];
  session: RosterSession;
  view: FoundationViewModel;
  onOpen: (id: string) => void;
}) {
  const details = rosterWorkbenchEntries(view, session);
  return (
    <P1Card>
      <P1CardHeader>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-accent" />
          <P1CardTitle>{title}</P1CardTitle>
        </div>
        <P1CardDescription>{description}</P1CardDescription>
      </P1CardHeader>
      <P1CardContent className="space-y-3">
        {entries.map((entry) => {
          const detail = details.find((row) => row.employee.id === entry.employee.id);
          return (
            <div key={entry.employee.id} className="rounded-lg border border-border p-4">
              <div className="flex justify-between gap-3">
                <p className="text-sm font-medium">{entry.employee.name}</p>
                <P1Badge variant={entry.employee.kind === "human" ? "outline" : "secondary"}>
                  {kindLabel(entry.employee.kind)}
                </P1Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Identiteit: {entry.identity.displayName} ({entry.identity.kind}) · niet de Employee
              </p>
              <p className="mt-2 text-sm text-muted-foreground">{entry.employee.mandate}</p>
              <p className="mt-2 text-xs text-muted-foreground">{entry.employee.capabilities.join(" · ")}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Afdelingen:{" "}
                {detail?.departments.map((link) => `${link.departmentName} · ${link.role}`).join(" · ") || "—"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Projecten:{" "}
                {entry.assignments.map((assignment) => `${assignment.projectName} · ${assignment.role}`).join(" · ") ||
                  "—"}
              </p>
              <P1Button className="mt-3" variant="outline" onClick={() => onOpen(entry.employee.id)}>
                Open roster
              </P1Button>
            </div>
          );
        })}
      </P1CardContent>
    </P1Card>
  );
}

function DepartmentDetail({
  view,
  session,
  departmentId,
  onBack,
  onOverlay,
  onDepartmentPatch,
  onMembershipPatch,
}: {
  view: FoundationViewModel;
  session: RosterSession;
  departmentId: string;
  onBack: () => void;
  onOverlay: (partial: Partial<ShellOverlay>) => void;
  onDepartmentPatch: (patch: DepartmentPatch) => void;
  onMembershipPatch: (patch: MembershipPatch) => void;
}) {
  const opened = openDepartmentWorkbench({
    authenticated: true,
    actorTenantId: view.tenantId,
    workspaceId: view.tenantId,
    departmentId,
    view,
    session,
  });
  const [name, setName] = useState(opened.ok ? opened.workbench.department.name : "");
  const [purpose, setPurpose] = useState(opened.ok ? opened.workbench.department.purpose : "");
  const [capabilities, setCapabilities] = useState(
    opened.ok ? opened.workbench.department.capabilities.join(", ") : "",
  );
  const [memberId, setMemberId] = useState(view.roster[0]?.employee.id ?? "");
  const [memberRole, setMemberRole] = useState("Lid");
  const [projectId, setProjectId] = useState(view.projects[0]?.project.id ?? "");
  const [projectRole, setProjectRole] = useState("Meekijker");
  const [notice, setNotice] = useState<string | null>(null);

  if (!opened.ok) {
    return (
      <section className="space-y-4" aria-labelledby="department-denied">
        <h1 id="department-denied" className="text-2xl font-semibold">
          Afdeling niet beschikbaar
        </h1>
        <p className="text-sm text-muted-foreground">
          Onbekende of andere werkruimte. De workbench blijft gesloten.
        </p>
        <P1Button variant="outline" onClick={onBack}>
          Terug naar afdelingen
        </P1Button>
      </section>
    );
  }

  function saveDepartment(event: FormEvent) {
    event.preventDefault();
    const result = updateDepartment({
      authenticated: true,
      actorTenantId: view.tenantId,
      workspaceId: view.tenantId,
      departmentId,
      name,
      purpose,
      capabilities: parseCapabilities(capabilities),
      view,
    });
    if (!result.ok) {
      setNotice(result.reason === "legacy_taxonomy" ? "Geen vaste legacy-taxonomie." : "Afdeling kon niet worden gewijzigd.");
      return;
    }
    onDepartmentPatch(result.patch);
    setNotice("Afdeling lokaal aangepast. Dit verdwijnt bij herstel of herladen.");
  }

  function saveMembership(event: FormEvent) {
    event.preventDefault();
    const result = assignToDepartment({
      authenticated: true,
      actorTenantId: view.tenantId,
      workspaceId: view.tenantId,
      employeeId: memberId,
      departmentId,
      role: memberRole,
      view,
    });
    if (!result.ok) {
      setNotice("Medewerker kon niet aan deze afdeling worden gekoppeld.");
      return;
    }
    onMembershipPatch(result.patch);
    setNotice("Toewijzing lokaal toegevoegd. Dit verdwijnt bij herstel of herladen.");
  }

  function saveProject(event: FormEvent) {
    event.preventDefault();
    const result = assignToProject({
      authenticated: true,
      actorTenantId: view.tenantId,
      workspaceId: view.tenantId,
      employeeId: memberId,
      projectId,
      role: projectRole,
      nonce: `${Date.now()}`,
    });
    if (!result.ok) {
      setNotice("Projecttoewijzing kon niet worden gemaakt.");
      return;
    }
    onOverlay({ assignments: [result.assignment] });
    setNotice("Toewijzing lokaal toegevoegd. Dit verdwijnt bij herstel of herladen.");
  }

  const publish = opened.workbench.publishes[0];

  return (
    <section className="space-y-6" aria-labelledby="department-heading">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-accent">Afdeling-workbench</p>
          <h1 id="department-heading" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {opened.workbench.department.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {opened.workbench.department.purpose}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <P1Badge variant="denied">Publish: DENY</P1Badge>
          <P1Button variant="outline" onClick={onBack}>
            Alle afdelingen
          </P1Button>
        </div>
      </header>
      <P1Card>
        <P1CardHeader>
          <P1CardTitle>Configuratie</P1CardTitle>
          <P1CardDescription>Naam, doel en capabilities. Alleen binnen deze tenant.</P1CardDescription>
        </P1CardHeader>
        <P1CardContent>
          <form className="space-y-3" onSubmit={saveDepartment}>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
            />
            <P1Textarea value={purpose} onChange={(event) => setPurpose(event.target.value)} />
            <input
              value={capabilities}
              onChange={(event) => setCapabilities(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
            />
            <P1Button type="submit">Wijzig lokaal</P1Button>
          </form>
        </P1CardContent>
      </P1Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Leden</P1CardTitle>
            <P1CardDescription>Human en AI Employee, elk met eigen identiteit.</P1CardDescription>
          </P1CardHeader>
          <P1CardContent className="space-y-3">
            {opened.workbench.members.map((member) => (
              <div key={member.employee.id} className="rounded-lg border border-border p-3 text-sm">
                <div className="flex justify-between gap-3">
                  <strong>{member.employee.name}</strong>
                  <P1Badge variant={member.employee.kind === "human" ? "outline" : "secondary"}>
                    {kindLabel(member.employee.kind)}
                  </P1Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Identiteit {member.identity.displayName} · {member.role}
                </p>
              </div>
            ))}
          </P1CardContent>
        </P1Card>
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Projecten</P1CardTitle>
            <P1CardDescription>Projecten die bij deze afdeling horen. Publiceren blijft DENY.</P1CardDescription>
          </P1CardHeader>
          <P1CardContent className="space-y-3">
            {opened.workbench.projects.map((project) => (
              <p key={project.id} className="text-sm">
                {project.name}
              </p>
            ))}
            {publish ? (
              <div className="border-t border-border pt-3 text-sm">
                <p className="flex justify-between gap-3">
                  <span>Publiceren</span>
                  <P1Badge variant="denied">{publish.decision}</P1Badge>
                </p>
                <p className="mt-2 text-xs text-muted-foreground">{publish.reason}</p>
              </div>
            ) : null}
          </P1CardContent>
        </P1Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Medewerker ↔ afdeling</P1CardTitle>
            <P1CardDescription>Alleen in deze sessie.</P1CardDescription>
          </P1CardHeader>
          <P1CardContent>
            <form className="space-y-3" onSubmit={saveMembership}>
              <P1Select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
                {view.roster.map((entry) => (
                  <option key={entry.employee.id} value={entry.employee.id}>
                    {entry.employee.name} · {kindLabel(entry.employee.kind)}
                  </option>
                ))}
              </P1Select>
              <input
                value={memberRole}
                onChange={(event) => setMemberRole(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
              <P1Button type="submit">Wijs toe aan afdeling</P1Button>
            </form>
          </P1CardContent>
        </P1Card>
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Medewerker ↔ project</P1CardTitle>
            <P1CardDescription>Alleen in deze sessie.</P1CardDescription>
          </P1CardHeader>
          <P1CardContent>
            <form className="space-y-3" onSubmit={saveProject}>
              <P1Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                {view.projects.map((row) => (
                  <option key={row.project.id} value={row.project.id}>
                    {row.project.name}
                  </option>
                ))}
              </P1Select>
              <input
                value={projectRole}
                onChange={(event) => setProjectRole(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
              <P1Button type="submit">Wijs toe aan project</P1Button>
            </form>
          </P1CardContent>
        </P1Card>
      </div>
      {notice ? <p className="text-xs text-muted-foreground">{notice}</p> : null}
    </section>
  );
}

function RosterDetail({
  view,
  session,
  employeeId,
  onBack,
  onOverlay,
  onMembershipPatch,
}: {
  view: FoundationViewModel;
  session: RosterSession;
  employeeId: string;
  onBack: () => void;
  onOverlay: (partial: Partial<ShellOverlay>) => void;
  onMembershipPatch: (patch: MembershipPatch) => void;
}) {
  const entry = rosterWorkbenchEntries(view, session).find((row) => row.employee.id === employeeId);
  const [departmentId, setDepartmentId] = useState(view.departments[0]?.id ?? "");
  const [projectId, setProjectId] = useState(view.projects[0]?.project.id ?? "");
  const [role, setRole] = useState("Lid");
  const [notice, setNotice] = useState<string | null>(null);

  if (!entry) {
    return (
      <section className="space-y-4" aria-labelledby="roster-denied">
        <h1 id="roster-denied" className="text-2xl font-semibold">
          Medewerker niet beschikbaar
        </h1>
        <P1Button variant="outline" onClick={onBack}>
          Terug naar roster
        </P1Button>
      </section>
    );
  }

  function saveDepartment(event: FormEvent) {
    event.preventDefault();
    const result = assignToDepartment({
      authenticated: true,
      actorTenantId: view.tenantId,
      workspaceId: view.tenantId,
      employeeId,
      departmentId,
      role,
      view,
    });
    if (!result.ok) {
      setNotice("Afdelingstoewijzing kon niet worden gemaakt.");
      return;
    }
    onMembershipPatch(result.patch);
    setNotice("Toewijzing lokaal toegevoegd. Dit verdwijnt bij herstel of herladen.");
  }

  function saveProject(event: FormEvent) {
    event.preventDefault();
    const result = assignToProject({
      authenticated: true,
      actorTenantId: view.tenantId,
      workspaceId: view.tenantId,
      employeeId,
      projectId,
      role,
      nonce: `${Date.now()}`,
    });
    if (!result.ok) {
      setNotice("Projecttoewijzing kon niet worden gemaakt.");
      return;
    }
    onOverlay({ assignments: [result.assignment] });
    setNotice("Toewijzing lokaal toegevoegd. Dit verdwijnt bij herstel of herladen.");
  }

  return (
    <section className="space-y-6" aria-labelledby="roster-heading">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-accent">Roster</p>
          <h1 id="roster-heading" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {entry.employee.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Identity ≠ Employee ≠ Agent ≠ Runtime ≠ Model. Mandaat en capabilities horen bij de Employee.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <P1Badge variant={entry.employee.kind === "human" ? "outline" : "secondary"}>
            {kindLabel(entry.employee.kind)}
          </P1Badge>
          <P1Badge variant="denied">Publish: DENY</P1Badge>
          <P1Button variant="outline" onClick={onBack}>
            Alle medewerkers
          </P1Button>
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Identiteit</P1CardTitle>
            <P1CardDescription>Login- of service-identiteit. Niet de Employee.</P1CardDescription>
          </P1CardHeader>
          <P1CardContent className="space-y-2 text-sm">
            <p>
              <span className="block text-xs text-muted-foreground">Naam</span>
              {entry.identity.displayName}
            </p>
            <p>
              <span className="block text-xs text-muted-foreground">Soort</span>
              {entry.identity.kind}
            </p>
          </P1CardContent>
        </P1Card>
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Employee</P1CardTitle>
            <P1CardDescription>Geen Agent, Runtime of Model.</P1CardDescription>
          </P1CardHeader>
          <P1CardContent className="space-y-2 text-sm">
            <p>
              <span className="block text-xs text-muted-foreground">Mandaat</span>
              {entry.employee.mandate}
            </p>
            <p>
              <span className="block text-xs text-muted-foreground">Capabilities</span>
              {entry.employee.capabilities.join(" · ")}
            </p>
          </P1CardContent>
        </P1Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Afdelingen</P1CardTitle>
          </P1CardHeader>
          <P1CardContent className="space-y-2 text-sm">
            {entry.departments.map((link) => (
              <p key={link.departmentId}>
                {link.departmentName} <span className="text-muted-foreground">· {link.role}</span>
              </p>
            ))}
          </P1CardContent>
        </P1Card>
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Projecten</P1CardTitle>
          </P1CardHeader>
          <P1CardContent className="space-y-2 text-sm">
            {entry.assignments.map((assignment) => (
              <p key={`${assignment.projectId}:${assignment.role}`}>
                {assignment.projectName} <span className="text-muted-foreground">· {assignment.role}</span>
              </p>
            ))}
          </P1CardContent>
        </P1Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Wijs toe aan afdeling</P1CardTitle>
          </P1CardHeader>
          <P1CardContent>
            <form className="space-y-3" onSubmit={saveDepartment}>
              <P1Select value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
                {view.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </P1Select>
              <input
                value={role}
                onChange={(event) => setRole(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm"
              />
              <P1Button type="submit">Wijs toe</P1Button>
            </form>
          </P1CardContent>
        </P1Card>
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Wijs toe aan project</P1CardTitle>
          </P1CardHeader>
          <P1CardContent>
            <form className="space-y-3" onSubmit={saveProject}>
              <P1Select value={projectId} onChange={(event) => setProjectId(event.target.value)}>
                {view.projects.map((row) => (
                  <option key={row.project.id} value={row.project.id}>
                    {row.project.name}
                  </option>
                ))}
              </P1Select>
              <P1Button type="submit">Wijs toe</P1Button>
            </form>
          </P1CardContent>
        </P1Card>
      </div>
      {notice ? <p className="text-xs text-muted-foreground">{notice}</p> : null}
    </section>
  );
}
