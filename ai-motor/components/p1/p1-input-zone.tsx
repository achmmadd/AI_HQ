"use client";

import { useState, type FormEvent } from "react";
import { File, Mic, Phone, Type } from "lucide-react";
import type { FoundationViewModel } from "@/pilot/p1-foundation";
import {
  INPUT_ZONE,
  activateInput,
  prepareTypedDraft,
  type ShellOverlay,
} from "@/pilot/p1-shell";
import { P1Button, P1Textarea } from "@/components/p1/ui";
import { cn } from "@/lib/utils";

const ICONS = {
  type: Type,
  speak: Mic,
  call: Phone,
  file: File,
} as const;

export function P1InputZone({
  view,
  onPrepared,
}: {
  view: FoundationViewModel;
  onPrepared: (overlay: Pick<ShellOverlay, "drafts" | "attention">) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const projectId = view.projects[0]?.project.id;

  function handleAction(id: (typeof INPUT_ZONE)[number]["id"]) {
    const result = activateInput(id);
    if (!result.ok) {
      setOpen(false);
      return;
    }
    setNotice(null);
    setOpen(true);
  }

  function handleType(event: FormEvent) {
    event.preventDefault();
    if (!projectId) {
      setNotice("Geen project in deze werkruimte.");
      return;
    }
    const prepared = prepareTypedDraft({
      authenticated: true,
      actorTenantId: view.tenantId,
      workspaceId: view.tenantId,
      projectId,
      title,
      nonce: `${Date.now()}`,
    });
    if (!prepared.ok) {
      setNotice(
        prepared.reason === "empty_draft"
          ? "Typ eerst een korte titel."
          : "Concept kon niet worden voorbereid.",
      );
      return;
    }
    onPrepared({ drafts: [prepared.draft], attention: [prepared.attention] });
    setTitle("");
    setOpen(false);
    setNotice("Lokaal concept klaargezet als draft. Publiceren blijft DENY.");
  }

  return (
    <section
      className="rounded-2xl border border-border bg-card p-4 shadow-sm"
      aria-label="Universele invoer"
    >
      <p className="text-sm font-medium">Wat wil je doen?</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        Alleen Typen maakt een lokaal concept. Spreken, bellen en bestand zijn zichtbaar maar niet actief.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {INPUT_ZONE.map((item) => {
          const Icon = ICONS[item.id];
          const enabled = item.enabled;
          return (
            <P1Button
              key={item.id}
              type="button"
              variant={enabled ? "default" : "outline"}
              disabled={!enabled}
              aria-disabled={!enabled}
              title={enabled ? "Lokaal concept typen" : `${item.label} is in P1.1 niet geactiveerd`}
              className={cn("w-full", !enabled && "cursor-not-allowed")}
              onClick={enabled ? () => handleAction(item.id) : undefined}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </P1Button>
          );
        })}
      </div>
      {open ? (
        <form className="mt-4 space-y-3" onSubmit={handleType}>
          <label className="block text-sm font-medium" htmlFor="p1-typed-title">
            Nieuw concept
          </label>
          <P1Textarea
            id="p1-typed-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Korte interne notitie. Dit blijft een draft."
            maxLength={280}
          />
          <div className="flex flex-wrap gap-2">
            <P1Button type="submit">Bewaar als draft</P1Button>
            <P1Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Annuleren
            </P1Button>
          </div>
        </form>
      ) : null}
      {notice ? <p className="mt-3 text-xs text-muted-foreground">{notice}</p> : null}
    </section>
  );
}
