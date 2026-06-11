"use client";

/** Verdant Instrument — flat deep surface, no ambient glow */
export function BuilderBackground() {
  return (
    <div
      className="builder-ambient-bg pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <div className="builder-ambient-base absolute inset-0" />
      <div className="builder-ambient-grid absolute inset-0 opacity-[0.02]" />
    </div>
  );
}
