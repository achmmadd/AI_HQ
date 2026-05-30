"use client";

import { cn } from "@/lib/utils";

type Channel = "instagram" | "tiktok" | "linkedin";

const FRAME: Record<
  Channel,
  { label: string; aspect: string; maxW: string }
> = {
  instagram: { label: "Instagram 1:1", aspect: "aspect-square", maxW: "max-w-[280px]" },
  tiktok: { label: "TikTok 9:16", aspect: "aspect-[9/16]", maxW: "max-w-[200px]" },
  linkedin: {
    label: "LinkedIn 1.91:1",
    aspect: "aspect-[1.91/1]",
    maxW: "max-w-[360px]",
  },
};

function Frame({
  channel,
  text,
  emphasize,
}: {
  channel: Channel;
  text: string;
  emphasize?: boolean;
}) {
  const cfg = FRAME[channel];
  return (
    <div className="space-y-1">
      <p
        className={cn(
          "text-[10px] font-medium uppercase tracking-wide text-text-secondary",
          emphasize && "text-accent"
        )}
      >
        {cfg.label}
      </p>
      <div
        className={cn(
          "w-full overflow-hidden rounded-xl border bg-surface-elevated/50",
          cfg.aspect,
          cfg.maxW,
          emphasize ? "border-accent/50 ring-1 ring-accent/30" : "border-border"
        )}
      >
        <div className="h-full max-h-64 overflow-y-auto p-3">
          <p className="text-[11px] leading-relaxed whitespace-pre-wrap text-text-primary">
            {text || "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Eén kanaal (huidige platformkeuze gemarkeerd). */
export function ContentChannelPreviewFrames(props: {
  platform: Channel;
  text: string;
  className?: string;
}) {
  const { platform, text, className } = props;
  return (
    <div
      className={cn("flex flex-wrap gap-4", className)}
      aria-label="Voorbeeldweergave per kanaal (tekst alleen)"
    >
      <Frame channel={platform} text={text} emphasize />
    </div>
  );
}

/** Alle drie de beeldverhoudingen naast elkaar (zelfde tekst). */
export function ContentAllChannelPreviews(props: {
  text: string;
  active: Channel;
  className?: string;
}) {
  const { text, active, className } = props;
  const channels: Channel[] = ["instagram", "tiktok", "linkedin"];
  return (
    <div
      className={cn("flex flex-wrap items-end gap-4", className)}
      aria-label="Kanaalpreviews Instagram, TikTok, LinkedIn"
    >
      {channels.map((c) => (
        <Frame key={c} channel={c} text={text} emphasize={c === active} />
      ))}
    </div>
  );
}
