"use client";

import {
  FIRST_ACTION_OPTIONS,
  type FirstActionId,
} from "@/lib/onboarding-data";
import { SelectionCard } from "@/components/onboarding/selection-card";

type StepFirstActionProps = {
  selected: FirstActionId | null;
  onSelect: (id: FirstActionId) => void;
};

export function StepFirstAction({ selected, onSelect }: StepFirstActionProps) {
  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
          Waar begin je?
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-text-secondary md:text-base">
          Kies je eerste actie — je kunt later alles aanpassen in instellingen.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIRST_ACTION_OPTIONS.map((action, i) => (
          <SelectionCard
            key={action.id}
            title={action.title}
            description={action.description}
            icon={action.icon}
            selected={selected === action.id}
            onSelect={() => onSelect(action.id)}
            index={i}
          />
        ))}
      </div>
    </>
  );
}
