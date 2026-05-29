"use client";

import { useState } from "react";
import { PhotoStudioGenerator } from "@/components/photo-studio/photo-studio-generator";
import {
  PhotoStudioOutput,
  type GeneratedOutput,
} from "@/components/photo-studio/photo-studio-output";
import { PhotoStudioLibraryStrip } from "@/components/photo-studio/photo-studio-library-strip";
import { PhotoStudioCarousel } from "@/components/photo-studio/photo-studio-carousel";
import { PhotoStudioMenuBatch } from "@/components/photo-studio/photo-studio-menu-batch";
import type { CompanyId } from "@/lib/types";

type Props = {
  klant: CompanyId;
  title?: string;
  description?: string;
};

export function PhotoStudioPanel({
  klant,
  title = "Photo Studio",
  description = "Genereer product- en foodfoto's met fal.ai — tekst naar beeld of verbeter een upload.",
}: Props) {
  const [output, setOutput] = useState<GeneratedOutput | null>(null);
  const [libRefresh, setLibRefresh] = useState(0);
  const [tab, setTab] = useState<"generate" | "carousel" | "menu">("generate");
  const bumpLibrary = () => setLibRefresh((n) => n + 1);

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#171717]">{title}</h1>
        <p className="mt-1 text-sm text-[#737373]">{description}</p>
      </header>
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            ["generate", "Genereren"],
            ["carousel", "Carousel"],
            ["menu", "Menu-batch"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === id ? "bg-[#171717] text-white" : "bg-[#F5F5F5] text-[#525252]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "generate" ? (
        <>
          <PhotoStudioGenerator klant={klant} onGenerated={setOutput} />
          <PhotoStudioOutput
            klant={klant}
            output={output}
            onScheduled={bumpLibrary}
          />
        </>
      ) : null}
      {tab === "carousel" ? (
        <PhotoStudioCarousel klant={klant} onDone={bumpLibrary} />
      ) : null}
      {tab === "menu" ? (
        <PhotoStudioMenuBatch klant={klant} onDone={bumpLibrary} />
      ) : null}

      <PhotoStudioLibraryStrip klant={klant} refreshKey={libRefresh} />
    </div>
  );
}
