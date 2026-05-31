"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Rocket, Settings2 } from "lucide-react";
import { FumeroGeavanceerdPanel } from "@/components/fumero/features/fumero-geavanceerd-panel";
import {
  FumeroPublishModal,
  type FumeroPublishModalPayload,
} from "@/components/fumero/features/fumero-publish-modal";
import { FumeroChatSkeleton } from "@/components/fumero/ops/fumero-skeleton";
import { MotorsChatWorkspace } from "@/components/motors-chat-workspace";
import { useFumeroBriefing } from "@/components/fumero/max/fumero-briefing-provider";
import { Button } from "@/components/ui/button";
import {
  EMPTY_BOUWEN_BRIDGE,
  type FumeroBouwenBridge,
} from "@/lib/fumero/bouwen-bridge";
import { runtimeBadgeLabel } from "@/lib/fumero/project-runtime";
import {
  FUMERO_TOOL_TEMPLATES,
  getTemplate,
} from "@/lib/fumero/tool-templates";
import {
  readEnabledConnectors,
  writeEnabledConnectors,
} from "@/lib/connectors/session";
import { cn } from "@/lib/utils";

function BouwenTemplateChips({
  disabled,
  onPick,
}: {
  disabled?: boolean;
  onPick: (prompt: string) => void;
}) {
  const featured = FUMERO_TOOL_TEMPLATES.slice(0, 6);
  return (
    <div className="flex flex-wrap justify-center gap-2 px-4 pb-2">
      {featured.map((tpl) => (
        <button
          key={tpl.id}
          type="button"
          disabled={disabled}
          className={cn(
            "rounded-full border border-[#E5E5E5] bg-white px-3 py-1.5 text-[12px] font-medium text-[#525252]",
            "transition-colors hover:border-[#69C400]/40 hover:text-[#171717] disabled:opacity-50"
          )}
          onClick={() => onPick(`Bouw ${tpl.title.toLowerCase()}: ${tpl.promptSeed}`)}
        >
          {tpl.title}
        </button>
      ))}
    </div>
  );
}

function BouwenShellInner() {
  const sp = useSearchParams();
  const sendPromptRef = useRef<(prompt: string) => void>(() => {});
  const { data, openingMessage, quickActions, registerSendPrompt, sendFromBriefing } =
    useFumeroBriefing();
  const [bridge, setBridge] = useState<FumeroBouwenBridge>(EMPTY_BOUWEN_BRIDGE);
  const [geavanceerdOpen, setGeavanceerdOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishPayload, setPublishPayload] =
    useState<FumeroPublishModalPayload | null>(null);
  const [templateSeed, setTemplateSeed] = useState<string | null>(null);

  useEffect(() => {
    const defaults = readEnabledConnectors().filter(
      (id) => id !== "fumero_orders" && id !== "fumero_briefing"
    );
    writeEnabledConnectors(defaults);
  }, []);

  useEffect(() => {
    registerSendPrompt((prompt: string) => {
      sendPromptRef.current(prompt);
    });
  }, [registerSendPrompt]);

  useEffect(() => {
    const tpl = sp.get("template");
    if (tpl) {
      const t = getTemplate(tpl);
      if (t) setTemplateSeed(`Bouw ${t.title.toLowerCase()}: ${t.promptSeed}`);
    }
  }, [sp]);

  const initialPrompt = sp.get("q") || templateSeed;

  const handleTemplatePick = useCallback(
    (prompt: string) => {
      sendFromBriefing(prompt);
    },
    [sendFromBriefing]
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--fumero-bg)]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#E5E5E5] bg-white px-4 py-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[15px] font-semibold text-[#171717]">Bouwen</h1>
            {bridge.runtime ? (
              <span className="rounded-full border border-[#E5E5E5] bg-[#FAFAFA] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#525252]">
                {runtimeBadgeLabel(bridge.runtime)}
              </span>
            ) : null}
          </div>
          <p className="text-[11px] text-[#737373]">
            {bridge.runtime === "full_app"
              ? "Data-gedreven app — preview rechts · online zetten wanneer klaar"
              : bridge.runtime === "react"
                ? "Website / multi-file — preview rechts · online zetten wanneer klaar"
                : "Beschrijf je tool — preview rechts · online zetten wanneer klaar"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 rounded-lg border-[#E5E5E5] text-xs"
            onClick={() => setGeavanceerdOpen(true)}
          >
            <Settings2 className="mr-1 h-3.5 w-3.5" />
            Geavanceerd
          </Button>
          <Button
            type="button"
            size="sm"
            className="h-8 rounded-lg bg-[#69C400] text-xs shadow-none hover:bg-[#5db000]"
            disabled={!bridge.canPublish || bridge.toolBusy}
            onClick={() => void bridge.publish()}
          >
            <Rocket className="mr-1 h-3.5 w-3.5" />
            Online zetten
          </Button>
        </div>
      </header>

      {!bridge.activeToolId && !bridge.toolBusy ? (
        <BouwenTemplateChips disabled={bridge.toolBusy} onPick={handleTemplatePick} />
      ) : null}

      <div className="min-h-0 flex-1 overflow-hidden">
        <MotorsChatWorkspace
          className="bg-[var(--fumero-bg)]"
          initialComposerMode="coder"
          bouwenWorkspace
          initialPrompt={initialPrompt}
          maxCompanion={{
            briefing: data,
            openingMessage,
            quickActions,
            registerSend: (fn) => {
              sendPromptRef.current = fn;
            },
          }}
          onBouwenBridgeUpdate={setBridge}
          onPublishSuccess={(payload) => {
            setPublishPayload(payload);
            setPublishOpen(true);
          }}
        />
      </div>

      <FumeroPublishModal
        open={publishOpen}
        payload={publishPayload}
        onClose={() => {
          setPublishOpen(false);
          setPublishPayload(null);
        }}
      />

      <FumeroGeavanceerdPanel
        open={geavanceerdOpen}
        onClose={() => setGeavanceerdOpen(false)}
        toolId={bridge.activeToolId}
        toolSlug={bridge.toolSlug}
        embedCode={bridge.embedCode}
        appSlug={bridge.activeAppSlug}
      />
    </div>
  );
}

export function FumeroBouwenShell() {
  return (
    <Suspense fallback={<FumeroChatSkeleton />}>
      <BouwenShellInner />
    </Suspense>
  );
}
