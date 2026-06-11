"use client";

import { GOAL_OPTIONS, type OnboardingGoalId } from "@/lib/onboarding-data";
import { SelectionCard } from "@/components/onboarding/selection-card";

type StepGoalProps = {
  selected: OnboardingGoalId | null;
  onSelect: (id: OnboardingGoalId) => void;
};

export function StepGoal({ selected, onSelect }: StepGoalProps) {
  return (
    <>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">
          Wat wil je bereiken?
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-text-secondary md:text-base">
          Kies je primaire doel. MotorsAI bouwt je team en workflows hieromheen.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {GOAL_OPTIONS.map((goal, i) => (
          <SelectionCard
            key={goal.id}
            title={goal.title}
            description={goal.description}
            icon={goal.icon}
            selected={selected === goal.id}
            onSelect={() => onSelect(goal.id)}
            index={i}
          />
        ))}
      </div>
    </>
  );
}
