"use client";

import type { ContentStudioMediaType } from "@/lib/photo-studio/types";

type Props = {
  value: ContentStudioMediaType;
  onChange: (value: ContentStudioMediaType) => void;
};

export function ContentStudioMediaToggle({ value, onChange }: Props) {
  return (
    <div
      className="content-studio-media-toggle flex shrink-0 items-center gap-0.5 rounded-lg border border-[var(--fumero-border)] p-0.5"
      role="group"
      aria-label="Mediatype"
    >
      <button
        type="button"
        className={`content-studio-media-btn fumero-text-body-sm h-9 rounded-md px-3 font-medium ${
          value === "image"
            ? "content-studio-media-btn--active"
            : "text-[var(--fumero-text-muted)] hover:text-[var(--fumero-text)]"
        }`}
        aria-pressed={value === "image"}
        onClick={() => onChange("image")}
      >
        Beeld
      </button>
      <button
        type="button"
        className={`content-studio-media-btn fumero-text-body-sm h-9 rounded-md px-3 font-medium ${
          value === "video"
            ? "content-studio-media-btn--active"
            : "text-[var(--fumero-text-muted)] hover:text-[var(--fumero-text)]"
        }`}
        aria-pressed={value === "video"}
        onClick={() => onChange("video")}
      >
        Video
      </button>
    </div>
  );
}
