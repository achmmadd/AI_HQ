"use client";

import { BokasShell } from "@/components/bokas/bokas-shell";
import { BokasAiAssistent } from "@/components/bokas/bokas-ai-assistent";

export default function BokasChatPage() {
  return (
    <BokasShell page="Chat" actionLabel="Nieuwe chat" actionHref="/bokas/chat/workspace">
      <BokasAiAssistent />
    </BokasShell>
  );
}
