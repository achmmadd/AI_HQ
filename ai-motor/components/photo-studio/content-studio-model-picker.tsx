"use client";

import { ChevronDown } from "lucide-react";
import { FAL_MODEL_REGISTRY } from "@/lib/photo-studio/fal-model-registry";
import type { ContentStudioModelId } from "@/lib/photo-studio/types";

type Props = {
  value: ContentStudioModelId;
  onChange?: (model: ContentStudioModelId) => void;
};

const MODELS: ContentStudioModelId[] = [
  "nano-banana-2",
  "seedream-5-lite",
  "gpt-image-2",
];

export function ContentStudioModelPicker({ value, onChange }: Props) {
  const active = FAL_MODEL_REGISTRY[value];

  return (
    <div className="relative shrink-0">
      <select
        value={value}
        onChange={(e) => onChange?.(e.target.value as ContentStudioModelId)}
        className="content-studio-model-select fumero-text-body-sm h-9 appearance-none rounded-lg border border-[var(--fumero-border)] bg-[var(--fumero-surface)] py-0 pl-3 pr-8 font-medium text-[var(--fumero-text)]"
        aria-label="Model"
      >
        {MODELS.map((id) => {
          const meta = FAL_MODEL_REGISTRY[id];
          return (
            <option key={id} value={id}>
              {meta.label}
            </option>
          );
        })}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fumero-text-muted)]"
        aria-hidden
      />
      <span className="sr-only">{active.label}</span>
    </div>
  );
}
