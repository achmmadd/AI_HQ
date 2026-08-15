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
import type { FoundationViewModel, P1AttentionItem, ProjectView } from "@/pilot/p1-foundation";
import type { ShellOverlay } from "@/pilot/p1-shell";
import {
  appendAttentionPatch,
  appendProjectPatch,
  resolveClientProjectId,
  type AttentionPatch,
  type InboxFilter,
  type ProjectPatch,
} from "@/pilot/p1-workbench";
import {
  EMPTY_ROSTER_SESSION,
  appendDepartmentPatch,
  appendMembershipPatch,
  appendRosterOverlay,
  asWorkbenchSession,
  resetRosterSession,
  withWorkbenchUpdate,
  type RosterSession,
} from "@/pilot/p1-roster";
import {
  appendReviewPatch,
  mergeReviewSession,
  resetReviewPatches,
  resolveClientDraftId,
  reviewStatusBadgeVariant,
  reviewStatusForDraft,
  type ReviewPatch,
} from "@/pilot/p1-review";
import { P1Inbox } from "@/components/p1/p1-inbox";
import { P1InputZone } from "@/components/p1/p1-input-zone";
import { P1ProjectWorkbench } from "@/components/p1/p1-project-workbench";
import { P1ReviewPanel } from "@/components/p1/p1-review-panel";
import { P1Departments } from "@/components/p1/p1-departments";
import { P1EvidenceRail } from "@/components/p1/p1-evidence-rail";
import { P1BlockGallery } from "@/components/p1/p1-block-gallery";
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

function ProjectCard({ row, onOpen }: { row: ProjectView; onOpen: () => void }) {
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
            <div className="flex flex-wrap gap-2">
              <P1Badge variant={project.state === "jij_nodig" ? "warning" : "secondary"}>
                {project.state === "jij_nodig" ? "Jij nodig" : "Actief"}
              </P1Badge>
              <P1Badge variant="denied">Publish: DENY</P1Badge>
            </div>
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
            {row.drafts.map((draft) => {
              const status = reviewStatusForDraft(draft, row.reviews);
              return (
                <p key={draft.id} className="flex justify-between gap-3">
                  <span>{draft.title ?? "Concept"}</span>
                  <P1Badge variant={reviewStatusBadgeVariant(status)}>{status}</P1Badge>
                </p>
              );
            })}
            {row.reviews.map((review) => (
              <p key={review.id} className="flex justify-between gap-3">
                <span>Review</span>
                <P1Badge variant={reviewStatusBadgeVariant(review.state)}>{review.state}</P1Badge>
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
      <P1Button variant="outline" onClick={onOpen}>
        Open workbench
      </P1Button>
    </div>
  );
}

function ProjectsView({
  view,
  onOpen,
}: {
  view: FoundationViewModel;
  onOpen: (projectId: string) => void;
}) {
  return (
    <section className="space-y-6" aria-labelledby="projects-heading">
      <header>
        <p className="text-sm font-medium text-accent">Werkruimtes</p>
        <h1 id="projects-heading" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Projecten
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Werkruimte {view.tenantId}: doel, team, gekoppelde concepten en contextstatus (alleen digest).
        </p>
      </header>
      {view.projects.map((row) => (
        <ProjectCard key={row.project.id} row={row} onOpen={() => onOpen(row.project.id)} />
      ))}
    </section>
  );
}

export function P1FoundationShell({ view }: { view: FoundationViewModel }) {
  const [current, setCurrent] = useState<View>("now");
  const [session, setSession] = useState<RosterSession>(EMPTY_ROSTER_SESSION);
  const [reviewPatches, setReviewPatches] = useState<readonly ReviewPatch[]>(resetReviewPatches());
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [openedAttentionId, setOpenedAttentionId] = useState<string | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [reviewOpenedFrom, setReviewOpenedFrom] = useState<"inbox" | "workbench" | "attention">(
    "workbench",
  );
  const merged = mergeReviewSession(view, session, reviewPatches);

  function appendOverlay(partial: Partial<ShellOverlay>) {
    setSession((previous) => appendRosterOverlay(previous, partial));
  }

  function openProject(projectId: string, attentionId?: string) {
    const allowed = resolveClientProjectId(merged, projectId);
    if (!allowed) return;
    setSelectedProjectId(allowed);
    setOpenedAttentionId(attentionId ?? null);
    setCurrent("projects");
  }

  function openAttention(item: P1AttentionItem) {
    openProject(item.projectId, item.id);
  }

  function openDraft(draftId: string, from: "inbox" | "workbench" | "attention" = "workbench") {
    const allowed = resolveClientDraftId(merged, draftId);
    if (!allowed) return;
    setSelectedDraftId(allowed);
    setReviewOpenedFrom(from);
  }

  function applyPatches(next: { attentionPatch?: AttentionPatch; projectPatch?: ProjectPatch }) {
    setSession((previous) => {
      let workbench = asWorkbenchSession(previous);
      if (next.attentionPatch) workbench = appendAttentionPatch(workbench, next.attentionPatch);
      if (next.projectPatch) workbench = appendProjectPatch(workbench, next.projectPatch);
      return withWorkbenchUpdate(previous, workbench);
    });
  }

  const workbenchId = resolveClientProjectId(merged, selectedProjectId);
  const reviewId = resolveClientDraftId(merged, selectedDraftId);
  const body =
    reviewId ? (
      <P1ReviewPanel
        key={reviewId}
        view={merged}
        draftId={reviewId}
        openedFrom={reviewOpenedFrom}
        onBack={() => setSelectedDraftId(null)}
        onDecided={(patch) => setReviewPatches((previous) => appendReviewPatch(previous, patch))}
      />
    ) : current === "projects" && workbenchId ? (
      <P1ProjectWorkbench
        key={`${workbenchId}:${openedAttentionId ?? ""}`}
        view={merged}
        projectId={workbenchId}
        attentionId={openedAttentionId}
        onBack={() => {
          setSelectedProjectId(null);
          setOpenedAttentionId(null);
        }}
        onReassigned={applyPatches}
        onOpenDraft={(draftId) => openDraft(draftId, "workbench")}
      />
    ) : current === "projects" ? (
      <ProjectsView view={merged} onOpen={(projectId) => openProject(projectId)} />
    ) : current === "departments" ? (
      <div className="space-y-8">
        <P1Departments
          view={merged}
          session={session}
          onOverlay={appendOverlay}
          onDepartmentPatch={(patch) => setSession((previous) => appendDepartmentPatch(previous, patch))}
          onMembershipPatch={(patch) => setSession((previous) => appendMembershipPatch(previous, patch))}
        />
        <P1BlockGallery view={merged} />
      </div>
    ) : (
      <div className="space-y-8">
        <P1Inbox
          view={merged}
          filter={inboxFilter}
          onFilter={setInboxFilter}
          onOpenItem={openAttention}
          onOpenDraft={(draftId) => openDraft(draftId, "inbox")}
        />
        <P1EvidenceRail view={merged} />
      </div>
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
                  onClick={() => {
                    setCurrent(item.id);
                    setSelectedDraftId(null);
                  }}
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
        <main className="min-w-0 flex-1 px-4 pb-56 pt-6 sm:px-6 md:px-10 md:pb-10 md:pt-10">
          <div className="mx-auto max-w-5xl space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <P1Badge variant="secondary">Synthetische demo</P1Badge>
                <P1Badge variant="denied">Publish: DENY</P1Badge>
                <P1Button
                  variant="ghost"
                  className="h-8 px-3 text-xs"
                  onClick={() => {
                    setSession(resetRosterSession());
                    setReviewPatches(resetReviewPatches());
                    setSelectedDraftId(null);
                  }}
                >
                  Herstel lokale sessie
                </P1Button>
              </div>
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" />
                {merged.organizationName}
              </p>
            </div>
            {body}
            <P1InputZone view={merged} onPrepared={appendOverlay} />
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
              onClick={() => {
                setCurrent(item.id);
                setSelectedDraftId(null);
              }}
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
