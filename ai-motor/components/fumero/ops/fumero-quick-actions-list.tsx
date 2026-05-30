"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Camera,
  Mail,
  Megaphone,
  MessageCircle,
  ShoppingCart,
  Star,
} from "lucide-react";
import {
  FUMERO_QUICK_ACTIONS,
  fumeroQuickActionUrl,
  type FumeroQuickActionIcon,
} from "@/lib/fumero-quick-actions";

const ICONS: Record<FumeroQuickActionIcon, LucideIcon> = {
  camera: Camera,
  mail: Mail,
  megaphone: Megaphone,
  "message-circle": MessageCircle,
  star: Star,
  "shopping-cart": ShoppingCart,
};

export function FumeroQuickActionsList({ disabled }: { disabled?: boolean }) {
  return (
    <ul className="grid gap-1 border-t border-[#E5E5E5] bg-[#FAFAFA] px-4 py-2">
      {FUMERO_QUICK_ACTIONS.map((action) => {
        const Icon = ICONS[action.icon] ?? MessageCircle;
        return (
          <li key={action.id}>
            <Link
              href={fumeroQuickActionUrl(action.id)}
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white disabled:pointer-events-none"
              aria-disabled={disabled}
            >
              <Icon className="h-4 w-4 shrink-0 text-[#737373]" strokeWidth={1.75} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[#171717]">{action.title}</p>
                <p className="truncate text-xs text-[#737373]">{action.desc}</p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
