"use client";

import { useState } from "react";
import {
  Blocks,
  CheckCircle2,
  CircleDot,
  FileText,
  FolderKanban,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type {
  AttentionStage,
  FoundationViewModel,
  P1AttentionItem,
  ProjectView,
} from "@/pilot/p1-foundation";
import { evidenceDisplayValue } from "@/pilot/p1-foundation";
import {
  P1Badge,
  P1Button,
  P1Card,
  P1CardContent,
  P1CardDescription,
  P1CardHeader,
  P1CardTitle,
} from "@/components/p1/ui";
import { cn } from "@/lib/utils";

type View = "now" | "projects" | "departments";

const navigation: ReadonlyArray<{ id: View; label: string; icon: typeof CircleDot }> = [
  { id: "now", label: "Nu", icon: CircleDot },
  { id: "projects", label: "Projecten", icon: FolderKanban },
  { id: "departments", label: "Afdelingen", icon: UsersRound },
];

function stageLabel(stage: AttentionStage): string {
  return { vraag: "Vraag", actief: "Actief", jij_nodig: "Jij nodig", klaar: "Klaar" }[stage];
}

function kindLabel(kind: P1AttentionItem["kind"]): string {
  return { approval: "Goedkeuring", failure: "Mislukt", outcome: "Uitkomst" }[kind];
}

function Trace({ item }: { item: P1AttentionItem }) {
  const refs = item.references;
  const cells: ReadonlyArray<readonly [string, string | null]> = [
    ["Taak", refs.taskId],
    ["Run", refs.runId],
    ["Attempt", refs.attemptId],
    ["Goedkeuring", refs.approvalId],
    ["Bewijs", refs.evidenceId],
  ];
  return (
    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-4 text-xs text-muted-foreground sm:grid-cols-3">
      {cells.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className="mt-0.5 truncate font-medium text-foreground">{evidenceDisplayValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function NowView({
  view,
  showProject,
}: {
  view: FoundationViewModel;
  showProject: () => void;
}) {
  const stages: readonly AttentionStage[] = view.now.stages;
  return (
    <section className="space-y-6" aria-labelledby="now-heading">
      <header>
        <p className="text-sm font-medium text-accent">Overzicht</p>
        <h1 id="now-heading" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Wat aandacht nodig heeft
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Vraag → Actief → Jij nodig → Klaar. Goedkeuringen, mislukkingen en uitkomsten; geen technische logs.
        </p>
      </header>
      <div className="grid gap-4 xl:grid-cols-4">
        {stages.map((stage) => {
          const items = view.now.items.filter((item) => item.stage === stage);
          const variant = stage === "jij_nodig" ? "warning" : stage === "klaar" ? "success" : "secondary";
          return (
            <div key={stage} className="space-y-3">
              <div className="flex justify-between px-1">
                <h2 className="text-sm font-semibold">{stageLabel(stage)}</h2>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              {items.map((item) => (
                <P1Card key={item.id} className={stage === "jij_nodig" ? "border-warning/40" : undefined}>
                  <P1CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <P1CardTitle className="text-sm leading-5">{item.title}</P1CardTitle>
                      <P1Badge variant={variant}>{stageLabel(stage)}</P1Badge>
                    </div>
                    <P1CardDescription>{item.summary}</P1CardDescription>
                  </P1CardHeader>
                  <P1CardContent>
                    <P1Badge variant="outline">{kindLabel(item.kind)}</P1Badge>
                    <Trace item={item} />
                    <P1Button variant="ghost" className="mt-3 -ml-3" onClick={showProject}>
                      Open project
                    </P1Button>
                  </P1CardContent>
                </P1Card>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProjectCard({ row }: { row: ProjectView }) {
  const { project } = row;
  return (
    <div className="space-y-4">
      <P1Card>
        <P1CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <P1CardTitle>{project.name}</P1CardTitle>
              <P1CardDescription>{project.goal}</P1CardDescription>
            </div>
            <P1Badge variant={project.state === "jij_nodig" ? "warning" : "secondary"}>
              {project.state === "jij_nodig" ? "Jij nodig" : "Actief"}
            </P1Badge>
          </div>
        </P1CardHeader>
        <P1CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Context</p>
            <p className="mt-1 text-sm font-medium">
              {project.context.status === "ready" ? "Manifest aanwezig" : "Manifest ontbreekt"}
            </p>
            <code className="mt-2 block truncate rounded bg-muted px-2 py-1 text-xs">
              {project.context.digest}
            </code>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Taken</p>
            <ul className="mt-1 space-y-1">
              {row.tasks.map((task) => (
                <li key={task.id} className="text-sm">
                  {task.title}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Team</p>
            <div className="mt-1 space-y-1">
              {row.team.map(({ employee, role }) => (
                <p key={employee.id} className="text-sm">
                  <strong>{employee.name}</strong>{" "}
                  <span className="text-muted-foreground">· {role}</span>
                </p>
              ))}
            </div>
          </div>
        </P1CardContent>
      </P1Card>
      <div className="grid gap-4 lg:grid-cols-3">
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Artifacts</P1CardTitle>
          </P1CardHeader>
          <P1CardContent className="space-y-3">
            {row.artifacts.map((artifact) => (
              <div key={artifact.id} className="flex gap-3 text-sm">
                <FileText className="h-4 w-4 shrink-0 text-accent" />
                <span>
                  {artifact.label}
                  <small className="ml-2 text-muted-foreground">{artifact.kind}</small>
                </span>
              </div>
            ))}
          </P1CardContent>
        </P1Card>
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Tijdlijn</P1CardTitle>
          </P1CardHeader>
          <P1CardContent className="space-y-3">
            {row.timeline.map((event) => (
              <div key={event.id}>
                <p className="text-sm font-medium">{event.label}</p>
                <p className="text-xs text-muted-foreground">{event.at}</p>
              </div>
            ))}
          </P1CardContent>
        </P1Card>
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Concept, review, publish</P1CardTitle>
            <P1CardDescription>Drie aparte objecten. Publiceren blijft DENY.</P1CardDescription>
          </P1CardHeader>
          <P1CardContent className="space-y-3 text-sm">
            {row.drafts.map((draft) => (
              <p key={draft.id} className="flex justify-between gap-3">
                <span>Concept</span>
                <P1Badge variant="outline">{draft.state}</P1Badge>
              </p>
            ))}
            {row.reviews.map((review) => (
              <p key={review.id} className="flex justify-between gap-3">
                <span>Review</span>
                <P1Badge variant="success">{review.state}</P1Badge>
              </p>
            ))}
            {row.publishes.map((publish) => (
              <div key={publish.id} className="space-y-2 border-t border-border pt-3">
                <p className="flex justify-between gap-3">
                  <span>Publiceren</span>
                  <P1Badge variant="denied">{publish.decision}</P1Badge>
                </p>
                <p className="text-xs text-muted-foreground">{publish.reason}</p>
              </div>
            ))}
          </P1CardContent>
        </P1Card>
      </div>
    </div>
  );
}

function ProjectsView({ view }: { view: FoundationViewModel }) {
  return (
    <section className="space-y-6" aria-labelledby="projects-heading">
      <header>
        <p className="text-sm font-medium text-accent">Werkruimtes</p>
        <h1 id="projects-heading" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Projecten
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Doel, team, contextstatus (alleen digest), taken, artifacts en tijdlijn.
        </p>
      </header>
      {view.projects.map((row) => (
        <ProjectCard key={row.project.id} row={row} />
      ))}
    </section>
  );
}

function DepartmentsView({ view }: { view: FoundationViewModel }) {
  return (
    <section className="space-y-6" aria-labelledby="departments-heading">
      <header>
        <p className="text-sm font-medium text-accent">Gedeelde structuur</p>
        <h1 id="departments-heading" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Afdelingen
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Configureerbare capabilities en teams. Geen vaste legacy-taxonomie.
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
            <P1CardContent>
              <p className="text-xs text-muted-foreground">Capabilities</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {department.capabilities.map((capability) => (
                  <P1Badge key={capability} variant="secondary">
                    {capability}
                  </P1Badge>
                ))}
              </div>
            </P1CardContent>
          </P1Card>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Roster</P1CardTitle>
            <P1CardDescription>
              Human en AI Employee zijn aparte Employees. Geen van beiden is een runtime of model.
            </P1CardDescription>
          </P1CardHeader>
          <P1CardContent className="space-y-3">
            {view.roster.map((entry) => (
              <div key={entry.employee.id} className="rounded-lg border border-border p-4">
                <div className="flex justify-between gap-3">
                  <p className="text-sm font-medium">{entry.employee.name}</p>
                  <P1Badge variant={entry.employee.kind === "human" ? "outline" : "secondary"}>
                    {entry.employee.kind === "human" ? "Mens" : "AI Employee"}
                  </P1Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Identiteit: {entry.identity.displayName} ({entry.identity.kind})
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{entry.employee.mandate}</p>
                <p className="mt-2 text-xs text-muted-foreground">{entry.employee.capabilities.join(" · ")}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {entry.assignments.map((assignment) => `${assignment.projectName} · ${assignment.role}`).join(" · ")}
                </p>
              </div>
            ))}
          </P1CardContent>
        </P1Card>
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
      </div>
    </section>
  );
}

export function P1FoundationShell({ view }: { view: FoundationViewModel }) {
  const [current, setCurrent] = useState<View>("now");
  const body =
    current === "projects" ? (
      <ProjectsView view={view} />
    ) : current === "departments" ? (
      <DepartmentsView view={view} />
    ) : (
      <NowView view={view} showProject={() => setCurrent("projects")} />
    );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-7xl">
        <aside className="hidden w-64 shrink-0 border-r border-border bg-card p-5 md:flex md:flex-col">
          <div className="mb-8 flex items-center gap-3">
            <div className="rounded-xl bg-primary p-2 text-primary-foreground">
              <Blocks className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Motor</p>
              <p className="text-xs text-muted-foreground">Intern teamplatform</p>
            </div>
          </div>
          <nav className="space-y-1" aria-label="Hoofdnavigatie">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = item.id === current;
              return (
                <P1Button
                  key={item.id}
                  variant={active ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => setCurrent(item.id)}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </P1Button>
              );
            })}
          </nav>
          <div className="mt-auto rounded-lg border border-border bg-muted/40 p-4">
            <p className="flex gap-2 text-sm font-medium">
              <ShieldCheck className="h-4 w-4 text-success" />
              Synthetische demo
            </p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Geen echte context, geen externe effecten, geen live-authority.
            </p>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 md:px-10 md:pb-10 md:pt-10">
          <div className="mx-auto max-w-5xl">
            <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <P1Badge variant="secondary">Synthetische demo</P1Badge>
                <P1Badge variant="denied">Publish: DENY</P1Badge>
              </div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {view.organizationName}
              </p>
            </div>
            {body}
          </div>
        </main>
      </div>
      <nav
        className="fixed inset-x-0 bottom-0 z-20 flex border-t border-border bg-card/95 p-2 backdrop-blur md:hidden"
        aria-label="Hoofdnavigatie"
      >
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = item.id === current;
          return (
            <button
              key={item.id}
              className={cn(
                "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-xs",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground",
              )}
              onClick={() => setCurrent(item.id)}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
