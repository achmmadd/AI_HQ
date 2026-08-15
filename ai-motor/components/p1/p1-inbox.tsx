"use client";

import type { AttentionStage, FoundationViewModel, P1AttentionItem } from "@/pilot/p1-foundation";
import { evidenceDisplayValue } from "@/pilot/p1-foundation";
import {
  attentionAssignmentLabels,
  filterInboxItems,
  inboxFilterOptions,
  type InboxFilter,
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

export function P1Inbox({
  view,
  filter,
  onFilter,
  onOpenItem,
  onOpenDraft,
}: {
  view: FoundationViewModel;
  filter: InboxFilter;
  onFilter: (next: InboxFilter) => void;
  onOpenItem: (item: P1AttentionItem) => void;
  onOpenDraft: (draftId: string) => void;
}) {
  const options = inboxFilterOptions(view);
  const items = filterInboxItems(view, filter);
  const stages: readonly AttentionStage[] = view.now.stages;
  const priorities = items.filter((item) => item.stage === "jij_nodig");
  const openConcepts = view.projects.flatMap((row) =>
    row.drafts.map((draft) => ({
      id: draft.id,
      title: draft.title ?? "Concept",
      state: reviewStatusForDraft(draft, row.reviews),
    })),
  );
  const reviewRows = view.projects.flatMap((row) =>
    row.drafts.map((draft) => {
      const status = reviewStatusForDraft(draft, row.reviews);
      const review = row.reviews.find((item) => item.draftId === draft.id);
      const publish = review
        ? row.publishes.find((item) => item.reviewId === review.id)
        : row.publishes[0];
      return {
        id: draft.id,
        projectName: row.project.name,
        reviewState: status,
        publishDecision: publish?.decision ?? "DENY",
      };
    }),
  );

  return (
    <section className="space-y-6" aria-labelledby="now-heading">
      <header>
        <p className="text-sm font-medium text-accent">Overzicht</p>
        <h1 id="now-heading" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
          Wat aandacht nodig heeft
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Filter op status, afdeling en eigenaar. Alleen samenvatting, status en bewijsreferenties.
        </p>
      </header>
      <fieldset className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-3">
        <legend className="sr-only">Inboxfilters</legend>
        <label className="block text-xs font-medium text-muted-foreground" htmlFor="inbox-status">
          Status
          <P1Select
            id="inbox-status"
            className="mt-1"
            value={filter.status ?? ""}
            onChange={(event) =>
              onFilter({ ...filter, status: (event.target.value || null) as AttentionStage | null })
            }
          >
            <option value="">Alle statussen</option>
            {options.statuses.map((status) => (
              <option key={status} value={status}>
                {stageLabel(status)}
              </option>
            ))}
          </P1Select>
        </label>
        <label className="block text-xs font-medium text-muted-foreground" htmlFor="inbox-department">
          Afdeling
          <P1Select
            id="inbox-department"
            className="mt-1"
            value={filter.departmentId ?? ""}
            onChange={(event) => onFilter({ ...filter, departmentId: event.target.value || null })}
          >
            <option value="">Alle afdelingen</option>
            {options.departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </P1Select>
        </label>
        <label className="block text-xs font-medium text-muted-foreground" htmlFor="inbox-owner">
          Eigenaar
          <P1Select
            id="inbox-owner"
            className="mt-1"
            value={filter.ownerId ?? ""}
            onChange={(event) => onFilter({ ...filter, ownerId: event.target.value || null })}
          >
            <option value="">Alle eigenaren</option>
            {options.owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </P1Select>
        </label>
      </fieldset>
      <div className="grid gap-4 md:grid-cols-3">
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Prioriteiten</P1CardTitle>
            <P1CardDescription>Waar jij nu nodig bent.</P1CardDescription>
          </P1CardHeader>
          <P1CardContent className="space-y-2">
            {priorities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Niets wacht op jou.</p>
            ) : (
              priorities.map((item) => (
                <p key={item.id} className="text-sm">
                  {item.title}
                </p>
              ))
            )}
          </P1CardContent>
        </P1Card>
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Open concepten</P1CardTitle>
            <P1CardDescription>Drafts in deze werkruimte.</P1CardDescription>
          </P1CardHeader>
          <P1CardContent className="space-y-2">
            {openConcepts.map((concept) => (
              <P1Button
                key={concept.id}
                variant="ghost"
                className="h-auto w-full justify-between gap-3 px-0 text-sm font-normal"
                onClick={() => onOpenDraft(concept.id)}
              >
                <span>{concept.title}</span>
                <P1Badge variant={reviewStatusBadgeVariant(concept.state)}>{concept.state}</P1Badge>
              </P1Button>
            ))}
          </P1CardContent>
        </P1Card>
        <P1Card>
          <P1CardHeader>
            <P1CardTitle>Reviewstatus</P1CardTitle>
            <P1CardDescription>Goedkeuren is niet publiceren.</P1CardDescription>
          </P1CardHeader>
          <P1CardContent className="space-y-2">
            {reviewRows.map((row) => (
              <P1Button
                key={row.id}
                variant="ghost"
                className="h-auto w-full flex-wrap justify-between gap-2 px-0 text-sm font-normal"
                onClick={() => onOpenDraft(row.id)}
              >
                <span>{row.projectName}</span>
                <span className="flex gap-2">
                  <P1Badge variant={reviewStatusBadgeVariant(row.reviewState)}>{row.reviewState}</P1Badge>
                  <P1Badge variant="denied">Publish: {row.publishDecision}</P1Badge>
                </span>
              </P1Button>
            ))}
          </P1CardContent>
        </P1Card>
      </div>
      <div className="grid gap-4 xl:grid-cols-4">
        {stages.map((stage) => {
          const stageItems = items.filter((item) => item.stage === stage);
          const variant = stage === "jij_nodig" ? "warning" : stage === "klaar" ? "success" : "secondary";
          return (
            <div key={stage} className="space-y-3">
              <div className="flex justify-between px-1">
                <h2 className="text-sm font-semibold">{stageLabel(stage)}</h2>
                <span className="text-xs text-muted-foreground">{stageItems.length}</span>
              </div>
              {stageItems.map((item) => {
                const labels = attentionAssignmentLabels(view, item);
                return (
                  <P1Card key={item.id} className={stage === "jij_nodig" ? "border-warning/40" : undefined}>
                    <P1CardHeader>
                      <div className="flex items-start justify-between gap-3">
                        <P1CardTitle className="text-sm leading-5">{item.title}</P1CardTitle>
                        <P1Badge variant={variant}>{stageLabel(stage)}</P1Badge>
                      </div>
                      <P1CardDescription>{item.summary}</P1CardDescription>
                    </P1CardHeader>
                    <P1CardContent>
                      <div className="flex flex-wrap gap-2">
                        <P1Badge variant="outline">{kindLabel(item.kind)}</P1Badge>
                        <P1Badge variant="secondary">{labels.department}</P1Badge>
                        <P1Badge variant="outline">{labels.owner}</P1Badge>
                      </div>
                      <Trace item={item} />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <P1Button variant="ghost" className="-ml-3" onClick={() => onOpenItem(item)}>
                          Open project
                        </P1Button>
                        {view.projects
                          .find((row) => row.project.id === item.projectId)
                          ?.drafts[0] ? (
                          <P1Button
                            variant="ghost"
                            onClick={() => {
                              const draft = view.projects.find((row) => row.project.id === item.projectId)
                                ?.drafts[0];
                              if (draft) onOpenDraft(draft.id);
                            }}
                          >
                            Open review
                          </P1Button>
                        ) : null}
                      </div>
                    </P1CardContent>
                  </P1Card>
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );
}
