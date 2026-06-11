"use client";

import {
  BUSINESS_TYPE_OPTIONS,
  type BusinessTypeId,
} from "@/lib/onboarding-data";
import { SelectionCard } from "@/components/onboarding/selection-card";
import type { WorkspaceId } from "@/lib/types";

type StepBusinessTypeProps = {
  selected: BusinessTypeId | null;
  allowedWorkspaces: WorkspaceId[];
  onSelect: (id: BusinessTypeId) => void;
};

export function StepBusinessType({
  selected,
  allowedWorkspaces,
  onSelect,
}: StepBusinessTypeProps) {
  const options = BUSINESS_TYPE_OPTIONS.filter((opt) =>
    allowedWorkspaces.includes(opt.workspace)
  );

  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
          Wat voor bedrijf ben je?
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-text-secondary md:text-base">
          Zo stemmen we agents, tone of voice en workflows af op jouw sector.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((biz, i) => (
          <SelectionCard
            key={biz.id}
            title={biz.title}
            description={biz.description}
            icon={biz.icon}
            selected={selected === biz.id}
            onSelect={() => onSelect(biz.id)}
            index={i}
          />
        ))}
      </div>
    </>
  );
}
