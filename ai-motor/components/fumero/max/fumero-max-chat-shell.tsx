"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { FumeroChatSkeleton } from "@/components/fumero/ops/fumero-skeleton";
import { useFumeroBriefing } from "@/components/fumero/max/fumero-briefing-provider";
import { MotorsChatWorkspace } from "@/components/motors-chat-workspace";
import type { FumeroComposerMode } from "@/lib/fumero/composer-actions";

export function FumeroMaxChatShell({
  forceCoderMode = false,
}: {
  forceCoderMode?: boolean;
} = {}) {
  const sp = useSearchParams();
  const sendPromptRef = useRef<(prompt: string) => void>(() => {});
  const { data, openingMessage, quickActions, registerSendPrompt } =
    useFumeroBriefing();
  const [coderActive, setCoderActive] = useState(
    forceCoderMode || sp.get("mode") === "coder"
  );

  const registerSend = useCallback((fn: (prompt: string) => void) => {
    sendPromptRef.current = fn;
  }, []);

  useEffect(() => {
    registerSendPrompt((prompt: string) => {
      sendPromptRef.current(prompt);
    });
  }, [registerSendPrompt]);

  const onComposerModeChange = useCallback((mode: FumeroComposerMode) => {
    setCoderActive(mode === "coder");
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Suspense fallback={<FumeroChatSkeleton />}>
        <div
          className={
            coderActive
              ? "min-h-0 flex-1 overflow-hidden bg-[var(--fumero-bg)]"
              : "min-h-0 flex-1 overflow-hidden bg-[var(--fumero-bg)] px-4 pt-4 md:px-6 md:pt-6"
          }
        >
          <MotorsChatWorkspace
            className="bg-[var(--fumero-bg)]"
            initialComposerMode={forceCoderMode ? "coder" : undefined}
            maxCompanion={{
              briefing: data,
              openingMessage,
              quickActions,
              registerSend,
            }}
            onComposerModeChange={onComposerModeChange}
          />
        </div>
      </Suspense>
    </div>
  );
}
