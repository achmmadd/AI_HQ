"use client";

type Props = {
  disabled?: boolean;
};

export function ContentStudioMediaToggle({ disabled = true }: Props) {
  return (
    <div
      className="content-studio-media-toggle flex shrink-0 items-center gap-0.5 rounded-lg border border-[var(--fumero-border)] p-0.5"
      role="group"
      aria-label="Mediatype"
    >
      <button
        type="button"
        className="content-studio-media-btn content-studio-media-btn--active fumero-text-body-sm h-9 rounded-md px-3 font-medium"
        aria-pressed
      >
        Beeld
      </button>
      <button
        type="button"
        className="content-studio-media-btn fumero-text-body-sm h-9 rounded-md px-3 font-medium text-[var(--fumero-text-muted)]"
        disabled={disabled}
        title="Binnenkort"
        aria-pressed={false}
      >
        Video
      </button>
    </div>
  );
}
