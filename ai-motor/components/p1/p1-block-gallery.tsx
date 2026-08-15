"use client";

import { openBlockGallery } from "@/pilot/p1-blocks";
import type { FoundationViewModel } from "@/pilot/p1-foundation";
import { P1Badge, P1Card, P1CardContent, P1CardDescription, P1CardHeader, P1CardTitle } from "@/components/p1/ui";

export function P1BlockGallery({ view }: { view: FoundationViewModel }) {
  const opened = openBlockGallery({
    authenticated: true,
    workspace: view.tenantId,
    view,
  });
  if (!opened.ok) return null;
  return (
    <P1Card>
      <P1CardHeader>
        <P1CardTitle>Compositie</P1CardTitle>
        <P1CardDescription>
          BlockManifests zijn data. Ze voeren niets uit en hebben geen authority.
        </P1CardDescription>
      </P1CardHeader>
      <P1CardContent className="grid gap-3 md:grid-cols-2">
        {opened.gallery.cards.map((card) => (
          <div key={card.id} className="rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{card.name}</p>
              <P1Badge variant="secondary">{card.risk}</P1Badge>
              <P1Badge variant="denied">niet uitvoerbaar</P1Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">scopes: {card.scopes.join(", ") || "—"}</p>
            <p className="mt-1 text-xs text-muted-foreground">effects: {card.effects.join(", ") || "geen"}</p>
            <code className="mt-2 block truncate text-xs">{card.evidenceDigest}</code>
          </div>
        ))}
      </P1CardContent>
    </P1Card>
  );
}
