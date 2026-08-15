"use client";

import { collectWorkspaceEvidence } from "@/pilot/p1-evidence";
import type { FoundationViewModel } from "@/pilot/p1-foundation";
import { P1Card, P1CardContent, P1CardDescription, P1CardHeader, P1CardTitle } from "@/components/p1/ui";

export function P1EvidenceRail({ view }: { view: FoundationViewModel }) {
  const rail = collectWorkspaceEvidence(view);
  return (
    <P1Card>
      <P1CardHeader>
        <P1CardTitle>Bewijsreferenties</P1CardTitle>
        <P1CardDescription>
          Alleen IDs, hashes en status. Geen concepttekst, geen context, geen logs.
        </P1CardDescription>
      </P1CardHeader>
      <P1CardContent>
        <ul className="space-y-2 text-sm">
          {rail.refs.map((ref) => (
            <li
              key={`${ref.source}:${ref.id}:${ref.digest ?? ""}`}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2"
            >
              <span className="font-medium">{ref.id}</span>
              <span className="text-xs text-muted-foreground">
                {ref.kind} · {ref.source} · {ref.status}
                {ref.digest ? ` · ${ref.digest.slice(0, 18)}…` : ""}
              </span>
            </li>
          ))}
        </ul>
      </P1CardContent>
    </P1Card>
  );
}
