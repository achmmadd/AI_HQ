"use client";

import { formatBriefingTime } from "@/lib/fumero/max-briefing-chat";
import { useFumeroBriefing } from "@/components/fumero/max/fumero-briefing-provider";
import { MaxBriefingDetailPanel } from "@/components/fumero/max/max-briefing-detail-panel";
import { FumeroBriefingStripSkeleton } from "@/components/fumero/ops/fumero-skeleton";

export function FumeroBriefingStrip({
  onSendPrompt,
}: {
  onSendPrompt?: (prompt: string) => void;
}) {
  const { data, loading, panelOpen, setPanelOpen, quickActions } = useFumeroBriefing();

  if (loading && !data) {
    return <FumeroBriefingStripSkeleton />;
  }

  const actionCount =
    (data?.actions.length ?? 0) +
    (data?.opportunities.length ?? 0);

  const timeLabel = data?.generated_at
    ? formatBriefingTime(data.generated_at)
    : loading
      ? "laden…"
      : "—";

  return (
    <>
      <div className="shrink-0 border-b border-[#E5E5E5] bg-white/80 px-4 py-1 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="shrink-0 text-[11px] font-medium text-[#a3a3a3]">
            Briefing · <span className="tabular-nums">{timeLabel}</span>
          </p>
          <p className="min-w-0 flex-1 truncate text-xs text-[#525252]">
            {loading
              ? "laden…"
              : data?.summary ?? "Geen briefing"}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {actionCount > 0 ? (
              <span className="inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-[#171717] px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-white">
                {actionCount}
              </span>
            ) : null}
            <button
              type="button"
              className="text-[11px] font-medium text-[#69C400] hover:text-[#5db000]"
              onClick={() => setPanelOpen(true)}
            >
              Details
            </button>
          </div>
        </div>
      </div>

      <MaxBriefingDetailPanel
        open={panelOpen}
        briefing={data}
        onClose={() => setPanelOpen(false)}
        onActionSelect={(prompt) => {
          setPanelOpen(false);
          onSendPrompt?.(prompt);
        }}
      />
    </>
  );
}
