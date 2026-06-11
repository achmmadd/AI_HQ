"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Hammer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function LandingBuildPrompt({
  placeholder,
  buttonLabel,
  className,
}: {
  placeholder: string;
  buttonLabel: string;
  className?: string;
}) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");

  const startBuild = () => {
    const q = prompt.trim();
    const target = q
      ? `/fumero/bouwen?q=${encodeURIComponent(q)}`
      : "/fumero/bouwen";
    router.push(`/login?from=${encodeURIComponent(target)}`);
  };

  return (
    <div className={cn("w-full max-w-xl", className)}>
      <div className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-[0_8px_32px_rgba(0,0,0,0.25)] sm:flex-row sm:items-center">
        <div className="flex min-h-[48px] flex-1 items-center gap-2 px-3">
          <Hammer className="h-4 w-4 shrink-0 text-[#a3e635]" aria-hidden />
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") startBuild();
            }}
            placeholder={placeholder}
            className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            aria-label={placeholder}
          />
        </div>
        <Button
          type="button"
          size="lg"
          className="h-11 shrink-0 rounded-xl bg-[#69C400] px-5 text-white hover:bg-[#5db000] sm:rounded-xl"
          onClick={startBuild}
        >
          {buttonLabel}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <p className="mt-2 text-center text-xs text-slate-500 sm:text-left">
        Gratis proberen in Fumero Studio — chatbot, landingspagina of tool in minuten.
      </p>
    </div>
  );
}
