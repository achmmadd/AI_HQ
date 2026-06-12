import { Suspense } from "react";
import { FumeroShell } from "@/components/fumero/fumero-shell";
import { CampaignStudioWizard } from "@/components/photo-studio/campaign-studio-wizard";

export default function FumeroCampaignStudioPage() {
  return (
    <FumeroShell
      page="Campaign Studio"
      breadcrumbs={[
        { label: "Fumero Studio", href: "/fumero" },
        { label: "Campaign Studio" },
      ]}
    >
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center p-8 fumero-text-body-sm text-[var(--fumero-text-muted)]">
            Campaign Studio laden…
          </div>
        }
      >
        <CampaignStudioWizard />
      </Suspense>
    </FumeroShell>
  );
}
