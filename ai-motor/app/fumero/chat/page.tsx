"use client";

import { FumeroShell } from "@/components/fumero/fumero-shell";
import { FumeroBriefingProvider } from "@/components/fumero/max/fumero-briefing-provider";
import { FumeroMaxChatShell } from "@/components/fumero/max/fumero-max-chat-shell";

export default function FumeroChatPage() {
  return (
    <FumeroBriefingProvider>
      <FumeroShell page="Max" flush showBriefing>
        <FumeroMaxChatShell />
      </FumeroShell>
    </FumeroBriefingProvider>
  );
}
