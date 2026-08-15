"use client";

import { useState, type FormEvent } from "react";
import { FileText } from "lucide-react";
import type { FoundationViewModel, P1AttentionItem } from "@/pilot/p1-foundation";
import {
  inboxFilterOptions,
  openProjectWorkbench,
  reassignAttention,
  reassignProject,
  type AttentionPatch,
  type ProjectPatch,
  type ProjectWorkbench,
} from "@/pilot/p1-workbench";
import { reviewStatusBadgeVariant, reviewStatusForDraft } from "@/pilot/p1-review";
import {
  P1Badge,
  P1Button,
  P1Card,
  P1CardContent,
  P1CardDescription,
  P1CardHeader,
  P1CardTitle,
  P1Select,
} from "@/components/p1/ui";

function WorkbenchBody({
  workbench,
  onOpenDraft,
}: {
  workbench: ProjectWorkbench;
  onOpenDraft: (draftId: string) => void;
}) {
  const publish = workbench.publishes[0];
  const review = workbench.reviews[0];
  return (
    <div className="space-y-4">
      <P1Card>
        <P1CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <P1CardTitle>{workbench.project.name}</P1CardTitle>
              <P1CardDescription>{workbench.project.goal}</P1CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <P1Badge variant={workbench.project.state === "jij_nodig" ? "warning" : "secondary"}>
                {workbench.project.state === "jij_nodig" ? "Jij nodig" : "Actief"}
              </P1Badge>
              <P1Badge variant="denied">Publish: DENY</P1Badge>
            </div>
          </div>
        </P1CardHeader>
        <P1CardContent className="grid gap-4 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Afdeling</p>
            <p className="mt-1 text-sm font-medium">{workbench.department?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Eigenaar</p>
            <p className="mt-1 text-sm font-medium">{workbench.owner?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Context</p>
            <p className="mt-1 text-sm font-medium">
              {workbench.project.context.status === "ready" ? "Manifest aanwezig" : "Manifest ontbreekt"}
            </p>
            <code className="mt-2 block truncate rounded bg-muted px-2 py-1 text-xs">
              {workbench.project.context.digest}
            </code>
          </div>
        </P1CardContent>
      </P1Card>
      {workbench.openedFrom ? (
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Aandacht → project → concept</P1CardTitle>
            <P1CardDescription>
              {workbench.openedFrom.title} opent dit project. Geen contextinhoud, geen ruwe logs.
            </P1CardDescription>
          </P1CardHeader>
          <P1CardContent className="grid gap-3 text-sm sm:grid-cols-3">
            <p>
              <span className="block text-xs text-muted-foreground">Aandachtspunt</span>
              {workbench.openedFrom.summary}
            </p>
            <p>
              <span className="block text-xs text-muted-foreground">Concept</span>
              {workbench.drafts[0]?.title ?? workbench.drafts[0]?.kind ?? "—"}
            </p>
            <p>
              <span className="block text-xs text-muted-foreground">Review / publish</span>
              {review?.state ?? "—"} · Publish: {publish?.decision ?? "DENY"}
            </p>
          </P1CardContent>
        </P1Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Taken</P1CardTitle>
          </P1CardHeader>
          <P1CardContent className="space-y-2">
            {workbench.tasks.map((task) => (
              <p key={task.id} className="flex justify-between gap-3 text-sm">
                <span>{task.title}</span>
                <P1Badge variant="outline">{task.status}</P1Badge>
              </p>
            ))}
          </P1CardContent>
        </P1Card>
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Artifacts</P1CardTitle>
          </P1CardHeader>
          <P1CardContent className="space-y-3">
            {workbench.artifacts.map((artifact) => (
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
            <P1CardTitle>Concepten en review</P1CardTitle>
            <P1CardDescription>Review/approved is zichtbaar. Publiceren blijft DENY.</P1CardDescription>
          </P1CardHeader>
          <P1CardContent className="space-y-3 text-sm">
            {workbench.drafts.map((draft) => {
              const status = reviewStatusForDraft(draft, workbench.reviews);
              return (
                <P1Button
                  key={draft.id}
                  variant="ghost"
                  className="h-auto w-full justify-between gap-3 px-0 font-normal"
                  onClick={() => onOpenDraft(draft.id)}
                >
                  <span>{draft.title ?? "Concept"}</span>
                  <P1Badge variant={reviewStatusBadgeVariant(status)}>{status}</P1Badge>
                </P1Button>
              );
            })}
            {workbench.reviews.map((item) => (
              <p key={item.id} className="flex justify-between gap-3">
                <span>Review</span>
                <P1Badge variant={reviewStatusBadgeVariant(item.state)}>{item.state}</P1Badge>
              </p>
            ))}
            {workbench.publishes.map((item) => (
              <div key={item.id} className="space-y-2 border-t border-border pt-3">
                <p className="flex justify-between gap-3">
                  <span>Publiceren</span>
                  <P1Badge variant="denied">{item.decision}</P1Badge>
                </p>
                <p className="text-xs text-muted-foreground">{item.reason}</p>
              </div>
            ))}
          </P1CardContent>
        </P1Card>
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Bewijsreferenties</P1CardTitle>
            <P1CardDescription>Alleen identifiers. Geen ruwe logs.</P1CardDescription>
          </P1CardHeader>
          <P1CardContent className="space-y-2">
            {workbench.evidence.map((ref) => (
              <p key={ref.id} className="flex justify-between gap-3 text-sm">
                <span>{ref.label}</span>
                <code className="truncate text-xs text-muted-foreground">{ref.id}</code>
              </p>
            ))}
          </P1CardContent>
        </P1Card>
      </div>
    </div>
  );
}

export function P1ProjectWorkbench({
  view,
  projectId,
  attentionId,
  onBack,
  onReassigned,
  onOpenDraft,
}: {
  view: FoundationViewModel;
  projectId: string;
  attentionId: string | null;
  onBack: () => void;
  onReassigned: (next: { attentionPatch?: AttentionPatch; projectPatch?: ProjectPatch }) => void;
  onOpenDraft: (draftId: string) => void;
}) {
  const opened = openProjectWorkbench({
    authenticated: true,
    actorTenantId: view.tenantId,
    workspaceId: view.tenantId,
    projectId,
    attentionId: attentionId ?? undefined,
    view,
  });
  const options = inboxFilterOptions(view);
  const [ownerId, setOwnerId] = useState(opened.ok ? (opened.workbench.owner?.id ?? "") : "");
  const [departmentId, setDepartmentId] = useState(opened.ok ? (opened.workbench.project.departmentId ?? "") : "");
  const [attentionOwnerId, setAttentionOwnerId] = useState(opened.ok ? (opened.workbench.openedFrom?.ownerId ?? "") : "");
  const [attentionDepartmentId, setAttentionDepartmentId] = useState(
    opened.ok ? (opened.workbench.openedFrom?.departmentId ?? "") : "",
  );
  const [notice, setNotice] = useState<string | null>(null);

  if (!opened.ok) {
    return (
      <section className="space-y-4" aria-labelledby="workbench-denied">
        <h1 id="workbench-denied" className="text-2xl font-semibold">
          Project niet beschikbaar
        </h1>
        <p className="text-sm text-muted-foreground">
          Onbekende of andere werkruimte. De workbench blijft gesloten.
        </p>
        <P1Button variant="outline" onClick={onBack}>
          Terug naar projecten
        </P1Button>
      </section>
    );
  }

  function saveProject(event: FormEvent) {
    event.preventDefault();
    const result = reassignProject({
      authenticated: true,
      actorTenantId: view.tenantId,
      workspaceId: view.tenantId,
      projectId,
      ownerEmployeeId: ownerId || undefined,
      departmentId: departmentId || undefined,
      view,
    });
    if (!result.ok) {
      setNotice("Toewijzing kon niet worden gewijzigd.");
      return;
    }
    onReassigned({ projectPatch: result.patch });
    setNotice("Lokale toewijzing aangepast. Dit verdwijnt bij herstel of herladen.");
  }

  function saveAttention(event: FormEvent, item: P1AttentionItem) {
    event.preventDefault();
    const result = reassignAttention({
      authenticated: true,
      actorTenantId: view.tenantId,
      workspaceId: view.tenantId,
      attentionId: item.id,
      ownerId: attentionOwnerId || undefined,
      departmentId: attentionDepartmentId || undefined,
      view,
    });
    if (!result.ok) {
      setNotice("Aandachtspunt kon niet worden toegewezen.");
      return;
    }
    onReassigned({ attentionPatch: result.patch });
    setNotice("Lokale toewijzing aangepast. Dit verdwijnt bij herstel of herladen.");
  }

  return (
    <section className="space-y-6" aria-labelledby="workbench-heading">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-accent">Project-workbench</p>
          <h1 id="workbench-heading" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {opened.workbench.project.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Taken, artifacts, concepten, reviews en bewijsreferenties. Publiceren blijft DENY.
          </p>
        </div>
        <P1Button variant="outline" onClick={onBack}>
          Alle projecten
        </P1Button>
      </header>
      <WorkbenchBody workbench={opened.workbench} onOpenDraft={onOpenDraft} />
      <div className="grid gap-4 lg:grid-cols-2">
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Projecttoewijzing</P1CardTitle>
            <P1CardDescription>Alleen binnen deze tenant, alleen in deze sessie.</P1CardDescription>
          </P1CardHeader>
          <P1CardContent>
            <form className="space-y-3" onSubmit={saveProject}>
              <label className="block text-xs font-medium text-muted-foreground" htmlFor="wb-owner">
                Eigenaar
                <P1Select id="wb-owner" className="mt-1" value={ownerId} onChange={(event) => setOwnerId(event.target.value)}>
                  {options.owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name}
                    </option>
                  ))}
                </P1Select>
              </label>
              <label className="block text-xs font-medium text-muted-foreground" htmlFor="wb-department">
                Afdeling
                <P1Select
                  id="wb-department"
                  className="mt-1"
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                >
                  {options.departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </P1Select>
              </label>
              <P1Button type="submit">Wijzig lokaal</P1Button>
            </form>
          </P1CardContent>
        </P1Card>
        {opened.workbench.openedFrom ? (
          <P1Card>
            <P1CardHeader>
              <P1CardTitle>Aandachtspunt toewijzen</P1CardTitle>
              <P1CardDescription>Eigenaar en afdeling van het geopende aandachtspunt.</P1CardDescription>
            </P1CardHeader>
            <P1CardContent>
              <form className="space-y-3" onSubmit={(event) => saveAttention(event, opened.workbench.openedFrom!)}>
                <label className="block text-xs font-medium text-muted-foreground" htmlFor="wb-att-owner">
                  Eigenaar
                  <P1Select
                    id="wb-att-owner"
                    className="mt-1"
                    value={attentionOwnerId}
                    onChange={(event) => setAttentionOwnerId(event.target.value)}
                  >
                    {options.owners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name}
                      </option>
                    ))}
                  </P1Select>
                </label>
                <label className="block text-xs font-medium text-muted-foreground" htmlFor="wb-att-department">
                  Afdeling
                  <P1Select
                    id="wb-att-department"
                    className="mt-1"
                    value={attentionDepartmentId}
                    onChange={(event) => setAttentionDepartmentId(event.target.value)}
                  >
                    {options.departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </P1Select>
                </label>
                <P1Button type="submit">Wijzig lokaal</P1Button>
              </form>
            </P1CardContent>
          </P1Card>
        ) : (
          <P1Card>
            <P1CardHeader>
              <P1CardTitle>Aandachtspunten</P1CardTitle>
              <P1CardDescription>Items die naar dit project wijzen.</P1CardDescription>
            </P1CardHeader>
            <P1CardContent className="space-y-2">
              {opened.workbench.attention.map((item) => (
                <p key={item.id} className="text-sm">
                  {item.title}
                </p>
              ))}
            </P1CardContent>
          </P1Card>
        )}
      </div>
      {notice ? <p className="text-xs text-muted-foreground">{notice}</p> : null}
    </section>
  );
}
