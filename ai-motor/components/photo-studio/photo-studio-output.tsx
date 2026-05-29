"use client";

import { Calendar, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PHOTO_STUDIO_ASPECTS } from "@/lib/photo-studio/variants";
import type { CompanyId } from "@/lib/types";

export type GeneratedOutput = {
  tracking_id: string;
  master_url: string;
  content_id: number | null;
  variants: Array<{
    aspect: string;
    public_url: string;
    width: number;
    height: number;
  }>;
};

type Props = {
  klant: CompanyId;
  output: GeneratedOutput | null;
  onScheduled?: () => void;
};

export function PhotoStudioOutput({ klant, output, onScheduled }: Props) {
  if (!output) return null;

  const labelFor = (aspect: string) =>
    PHOTO_STUDIO_ASPECTS.find((a) => a.aspect === aspect)?.label ?? aspect;

  const schedule = async () => {
    if (!output.content_id) return;
    const when = window.prompt(
      "Inplannen op (YYYY-MM-DD HH:MM, leeg = morgen 10:00):",
      ""
    );
    const res = await fetch("/api/photo-studio/schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        klant,
        content_id: output.content_id,
        datetime: when?.trim() || undefined,
        platform: "instagram",
      }),
    });
    const data = (await res.json()) as { error?: string; scheduled_at?: string };
    if (!res.ok) {
      alert(data.error || "Inplannen mislukt");
      return;
    }
    alert(`Ingepland: ${data.scheduled_at ?? "ok"}`);
    onScheduled?.();
  };

  return (
    <div className="mt-6 rounded-xl border border-[#E5E5E5] bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[#171717]">Formaten (Sharp)</h2>
        <span className="font-mono text-xs text-[#a3a3a3]">{output.tracking_id}</span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {output.variants.map((v) => (
          <a
            key={v.aspect}
            href={v.public_url}
            target="_blank"
            rel="noopener noreferrer"
            className="group overflow-hidden rounded-lg border border-[#E5E5E5] bg-[#FAFAFA]"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={v.public_url}
              alt={labelFor(v.aspect)}
              className="aspect-square w-full object-cover transition group-hover:opacity-90"
            />
            <div className="flex items-center justify-between gap-1 px-2 py-1.5 text-[10px] text-[#525252]">
              <span>{labelFor(v.aspect)}</span>
              <Download className="h-3 w-3 shrink-0 opacity-60" />
            </div>
          </a>
        ))}
      </div>

      {output.content_id ? (
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2"
          onClick={() => void schedule()}
        >
          <Calendar className="h-4 w-4" />
          Inplannen in Social-flow
        </Button>
      ) : null}
    </div>
  );
}
