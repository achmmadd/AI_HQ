"use client";

import { FumeroShell } from "@/components/fumero/fumero-shell";
import { FumeroPageHeader } from "@/components/fumero/ops/fumero-page-header";
import {
  FumeroCard,
  FumeroPageContent,
  FumeroSection,
} from "@/components/fumero/ui/fumero-primitives";
import { SettingsNav } from "@/components/settings/settings-nav";

export default function FumeroPayPage() {
  return (
    <FumeroShell page="Betalingen">
      <FumeroPageContent size="md">
        <SettingsNav />
        <FumeroPageHeader
          title="Betalingen"
          description="Branded checkout voor fumero.nl — iDEAL en optioneel crypto via Smokey."
        />

        <FumeroSection title="Status">
          <FumeroCard>
            <p className="fumero-text-body-sm text-[var(--fumero-text-muted)]">
              Online betalingen worden voorbereid. Tot de livegang gebruik je de
              bestaande checkout op fumero.nl. Zodra betalingen hier actief zijn,
              zie je status en transacties op deze pagina.
            </p>
          </FumeroCard>
        </FumeroSection>
      </FumeroPageContent>
    </FumeroShell>
  );
}
