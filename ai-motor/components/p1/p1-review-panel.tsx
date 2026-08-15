"use client";

import { useState } from "react";
import type { FoundationViewModel } from "@/pilot/p1-foundation";
import {
  attemptReviewPublish,
  decideReview,
  openReviewPanel,
  reviewStatusBadgeVariant,
  submitDraftForReview,
  type ReviewPatch,
} from "@/pilot/p1-review";
import {
  P1Badge,
  P1Button,
  P1Card,
  P1CardContent,
  P1CardDescription,
  P1CardHeader,
  P1CardTitle,
} from "@/components/p1/ui";

function statusLabel(status: "draft" | "in_review" | "approved" | "rejected"): string {
  return {
    draft: "Draft",
    in_review: "In review",
    approved: "Approved",
    rejected: "Rejected",
  }[status];
}

export function P1ReviewPanel({
  view,
  draftId,
  openedFrom,
  onBack,
  onDecided,
}: {
  view: FoundationViewModel;
  draftId: string;
  openedFrom: "inbox" | "workbench" | "attention";
  onBack: () => void;
  onDecided: (patch: ReviewPatch) => void;
}) {
  const opened = openReviewPanel({
    authenticated: true,
    actorTenantId: view.tenantId,
    workspaceId: view.tenantId,
    draftId,
    openedFrom,
    view,
  });
  const [notice, setNotice] = useState<string | null>(null);

  if (!opened.ok) {
    return (
      <section className="space-y-4" aria-labelledby="review-denied">
        <h1 id="review-denied" className="text-2xl font-semibold">
          Review niet beschikbaar
        </h1>
        <p className="text-sm text-muted-foreground">
          Onbekend concept of andere werkruimte. Het reviewpaneel blijft gesloten.
        </p>
        <P1Button variant="outline" onClick={onBack}>
          Terug
        </P1Button>
      </section>
    );
  }

  const { panel } = opened;

  function applyDecision(decision: "approve" | "reject") {
    const result = decideReview({
      authenticated: true,
      actorTenantId: view.tenantId,
      workspaceId: view.tenantId,
      draftId,
      decision,
      view,
    });
    if (!result.ok) {
      setNotice("Besluit kon niet lokaal worden gezet.");
      return;
    }
    onDecided(result.patch);
    setNotice(
      decision === "approve"
        ? "Lokaal goedgekeurd. Dit is geen publicatiebevoegdheid."
        : "Lokaal afgekeurd. Alleen zichtbaar in deze sessie.",
    );
  }

  function submit() {
    const result = submitDraftForReview({
      authenticated: true,
      actorTenantId: view.tenantId,
      workspaceId: view.tenantId,
      draftId,
      view,
    });
    if (!result.ok) {
      setNotice("Concept kon niet naar review.");
      return;
    }
    onDecided(result.patch);
    setNotice("Concept staat lokaal in review. Publiceren blijft DENY.");
  }

  function publish() {
    const attempt = attemptReviewPublish({
      authenticated: true,
      actorTenantId: view.tenantId,
      workspaceId: view.tenantId,
      draftId: panel.draftId,
      reviewId: panel.review?.id,
    });
    setNotice(`Publiceren: ${attempt.decision}. ${panel.publish.reason}`);
  }

  return (
    <section className="space-y-6" aria-labelledby="review-heading">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-accent">Reviewpaneel</p>
          <h1 id="review-heading" className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
            {panel.headline}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Draft, review en publish blijven aparte objecten. Approved is geen publicatiebevoegdheid.
          </p>
        </div>
        <P1Button variant="outline" onClick={onBack}>
          Terug
        </P1Button>
      </header>
      <P1Card>
        <P1CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <P1CardTitle>Reviewstatus</P1CardTitle>
              <P1CardDescription>Alleen binnen werkruimte {panel.tenantId}.</P1CardDescription>
            </div>
            <P1Badge variant={reviewStatusBadgeVariant(panel.status)}>{statusLabel(panel.status)}</P1Badge>
          </div>
        </P1CardHeader>
        <P1CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {panel.status === "draft" ? (
              <P1Button type="button" onClick={submit}>
                Zet in review
              </P1Button>
            ) : null}
            {panel.status === "in_review" ? (
              <>
                <P1Button type="button" onClick={() => applyDecision("approve")}>
                  Goedkeuren
                </P1Button>
                <P1Button type="button" variant="outline" onClick={() => applyDecision("reject")}>
                  Afkeuren
                </P1Button>
              </>
            ) : null}
            <P1Button type="button" variant="outline" onClick={publish}>
              Publiceren
            </P1Button>
            <P1Badge variant="denied">Publish: DENY</P1Badge>
          </div>
          <p className="text-xs text-muted-foreground">{panel.publish.reason}</p>
        </P1CardContent>
      </P1Card>
      <P1Card>
        <P1CardHeader>
          <P1CardTitle>Bewijsreferenties</P1CardTitle>
          <P1CardDescription>Alleen identifiers, hashes en status. Geen concept- of contexttekst.</P1CardDescription>
        </P1CardHeader>
        <P1CardContent className="space-y-2">
          {panel.evidence.refs.map((ref) => (
            <div key={ref.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <code className="truncate text-xs">{ref.id}</code>
              <span className="flex gap-2">
                <P1Badge variant="outline">{ref.kind}</P1Badge>
                <P1Badge variant={ref.status === "ready" ? "success" : "warning"}>{ref.status}</P1Badge>
              </span>
            </div>
          ))}
        </P1CardContent>
      </P1Card>
      {notice ? <p className="text-xs text-muted-foreground">{notice}</p> : null}
    </section>
  );
}
