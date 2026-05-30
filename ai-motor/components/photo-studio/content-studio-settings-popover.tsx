"use client";

import { useEffect, useRef } from "react";
import {
  normalizeQualityForModel,
  qualitiesForModel,
  type ContentStudioAspectRatio,
  type ContentStudioQuality,
  type ContentStudioSettings,
} from "@/lib/photo-studio/types";

const ASPECTS: ContentStudioAspectRatio[] = [
  "1:1",
  "4:3",
  "3:4",
  "16:9",
  "9:16",
];

const COUNTS = [1, 2, 3, 4, 5] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ContentStudioSettings;
  onChange: (patch: Partial<ContentStudioSettings>) => void;
  trigger: React.ReactNode;
};

function OptionRow<T extends string | number>({
  label,
  options,
  value,
  onSelect,
  disabledOptions,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onSelect: (v: T) => void;
  disabledOptions?: readonly T[];
}) {
  const disabled = new Set(disabledOptions ?? []);
  return (
    <div className="mb-3 last:mb-0">
      <p className="fumero-text-caption mb-1.5 text-[var(--fumero-text-muted)]">
        {label}
      </p>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={String(opt)}
            type="button"
            onClick={() => onSelect(opt)}
            disabled={disabled.has(opt)}
            className={`content-studio-settings-chip fumero-text-body-sm rounded-md px-2.5 py-1 font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              value === opt
                ? "content-studio-settings-chip--active"
                : "text-[var(--fumero-text-muted)] hover:bg-[var(--fumero-surface-muted)]"
            }`}
            aria-pressed={value === opt}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ContentStudioSettingsPopover({
  open,
  onOpenChange,
  settings,
  onChange,
  trigger,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const availableQualities = qualitiesForModel(settings.model);
  const allQualities: ContentStudioQuality[] = ["2K", "3K", "4K"];
  const disabledQualities = allQualities.filter(
    (q) => !availableQualities.includes(q)
  );

  useEffect(() => {
    const normalized = normalizeQualityForModel(settings.model, settings.quality);
    if (normalized !== settings.quality) {
      onChange({ quality: normalized });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only reset quality when model changes
  }, [settings.model]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onOpenChange]);

  return (
    <div className="relative" ref={ref}>
      <div onClick={() => onOpenChange(!open)}>{trigger}</div>
      {open ? (
        <div
          className="content-studio-settings-popover fumero-popover-elevated absolute bottom-full right-0 z-50 mb-2 w-[280px] rounded-[var(--fumero-radius-lg)] border border-[var(--fumero-border)] bg-[var(--fumero-surface-elevated,var(--fumero-surface))] p-4 shadow-[var(--fumero-shadow-sm)]"
          role="dialog"
          aria-label="Instellingen"
        >
          <OptionRow
            label="Beeldverhouding"
            options={ASPECTS}
            value={settings.aspect_ratio}
            onSelect={(aspect_ratio) => onChange({ aspect_ratio })}
          />
          <OptionRow
            label="Kwaliteit"
            options={allQualities}
            value={settings.quality}
            onSelect={(quality) => onChange({ quality })}
            disabledOptions={disabledQualities}
          />
          <OptionRow
            label="Aantal"
            options={COUNTS}
            value={settings.count}
            onSelect={(count) => onChange({ count })}
          />
          <div className="mt-3 border-t border-[var(--fumero-border)] pt-3">
            <label className="flex cursor-pointer items-center justify-between gap-2">
              <span className="fumero-text-body-sm text-[var(--fumero-text)]">
                Social formaten automatisch
              </span>
              <input
                type="checkbox"
                checked={settings.auto_variants}
                onChange={(e) => onChange({ auto_variants: e.target.checked })}
                className="h-4 w-4 accent-[var(--fumero-accent)]"
              />
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
}
