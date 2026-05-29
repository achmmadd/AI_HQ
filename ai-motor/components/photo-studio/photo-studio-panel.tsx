"use client";

import { useState } from "react";
import { PhotoStudioGenerator } from "@/components/photo-studio/photo-studio-generator";
import {
  PhotoStudioOutput,
  type GeneratedOutput,
} from "@/components/photo-studio/photo-studio-output";
import { PhotoStudioLibraryStrip } from "@/components/photo-studio/photo-studio-library-strip";
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

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[#171717]">{title}</h1>
        <p className="mt-1 text-sm text-[#737373]">{description}</p>
      </header>
      <PhotoStudioGenerator klant={klant} onGenerated={setOutput} />
      <PhotoStudioOutput
        klant={klant}
        output={output}
        onScheduled={() => setLibRefresh((n) => n + 1)}
      />
      <PhotoStudioLibraryStrip klant={klant} refreshKey={libRefresh} />
    </div>
  );
}
