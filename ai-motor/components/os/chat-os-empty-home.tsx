"use client";

import type { ReactNode } from "react";
import { AgentAvatar } from "@/components/AgentAvatar";
import { FumeroChatStarterCards } from "@/components/fumero/ops/fumero-chat-starter-cards";
import type { FumeroChatStarterWire } from "@/lib/fumero-quick-actions";
import { cn } from "@/lib/utils";

type ChatOsEmptyHomeProps = {
  agentName: string;
  subtitle: string;
  workspace: "fumero" | "bokas";
  disabled?: boolean;
  onWire: (wire: FumeroChatStarterWire) => void;
  excludeWires?: FumeroChatStarterWire[];
  bouwenLink?: ReactNode;
  className?: string;
};

export function ChatOsEmptyHome({
  agentName,
  subtitle,
  workspace,
  disabled,
  onWire,
  excludeWires,
  bouwenLink,
  className,
}: ChatOsEmptyHomeProps) {
  return (
    <div
      className={cn(
        "chat-os-empty-home flex w-full max-w-[640px] flex-col items-center gap-6 text-center",
        className
      )}
    >
      <AgentAvatar workspace={workspace} size="lg" />

      <div className="space-y-2">
        <h2 className="text-[22px] font-semibold tracking-tight text-[var(--os-text)]">
          Hey — ik ben {agentName}
        </h2>
        <p className="mx-auto max-w-[400px] text-[14px] leading-relaxed text-[var(--os-text-muted)]">
          {subtitle}
        </p>
      </div>

      <FumeroChatStarterCards
        disabled={disabled}
        onWire={onWire}
        excludeWires={excludeWires}
      />

      {bouwenLink ? (
        <p className="text-[12px] text-[var(--os-text-subtle)]">{bouwenLink}</p>
      ) : null}
    </div>
  );
}
