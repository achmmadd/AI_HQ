"use client";

import type { LucideIcon } from "lucide-react";
import {
  Camera,
  Code2,
  LayoutTemplate,
  ShoppingBag,
} from "lucide-react";
import {
  FUMERO_CHAT_STARTER_CARDS,
  type FumeroChatStarterWire,
} from "@/lib/fumero-quick-actions";
import { cn } from "@/lib/utils";

const WIRE_ICONS: Record<FumeroChatStarterWire, LucideIcon> = {
  foto: Camera,
  orders: ShoppingBag,
  canvas: LayoutTemplate,
  coder: Code2,
};

export function FumeroChatStarterCards({
  disabled,
  onWire,
  excludeWires,
}: {
  disabled?: boolean;
  onWire: (wire: FumeroChatStarterWire) => void;
  excludeWires?: FumeroChatStarterWire[];
}) {
  const excluded = new Set(excludeWires ?? []);
  const cards = FUMERO_CHAT_STARTER_CARDS.filter((c) => !excluded.has(c.wire));
  return (
    <div className="grid w-full max-w-2xl gap-4 sm:grid-cols-2">
      {cards.map((card) => {
        const Icon = WIRE_ICONS[card.wire];
        return (
          <button
            key={card.id}
            type="button"
            disabled={disabled}
            className={cn(
              "fumero-starter-card fumero-card-flat ios-tap-highlight flex flex-col gap-2 rounded-xl border border-[var(--fumero-border)] bg-[var(--fumero-surface)] p-4 text-left",
              "disabled:opacity-50"
            )}
            onClick={() => onWire(card.wire)}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--fumero-bg)] text-[var(--fumero-text-muted)]">
              <Icon className="h-[18px] w-[18px]" strokeWidth={1.5} />
            </span>
            <span>
              <span className="fumero-text-h3 block text-[var(--fumero-text)]">
                {card.title}
              </span>
              <span className="fumero-text-body-sm mt-1 block text-[var(--fumero-text-muted)]">
                {card.description}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
