"use client";
export type MobileTab = "make" | "results";
type Props = { active: MobileTab; onChange: (tab: MobileTab) => void };
export function MobileTabs({ active, onChange }: Props) {
  return (
    <div className="wc-mobile-tabs" role="tablist" aria-label="Studio panelen">
      {" "}
      <button
        type="button"
        role="tab"
        aria-selected={active === "make"}
        className={`wc-mobile-tab${active === "make" ? "wc-mobile-tab--active" : ""}`}
        onClick={() => onChange("make")}
        data-testid="mobile-tab-make"
      >
        {" "}
        Maken{" "}
      </button>{" "}
      <button
        type="button"
        role="tab"
        aria-selected={active === "results"}
        className={`wc-mobile-tab${active === "results" ? "wc-mobile-tab--active" : ""}`}
        onClick={() => onChange("results")}
        data-testid="mobile-tab-results"
      >
        {" "}
        Resultaten{" "}
      </button>{" "}
    </div>
  );
}
