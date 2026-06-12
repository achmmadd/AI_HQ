"use client";

import { BrandKitPanel, type BrandKitPanelProps } from "@/components/photo-studio/brand-kit-panel";

/** Wizard step 1 — full Brand Kit flow embedded in Campaign Studio. */
export type BrandKitWizardStepProps = Omit<BrandKitPanelProps, "variant">;

export function BrandKitWizardStep(props: BrandKitWizardStepProps) {
  return <BrandKitPanel variant="wizard" {...props} />;
}
