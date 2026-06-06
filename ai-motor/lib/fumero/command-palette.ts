import type { FumeroComposerMode } from "@/lib/fumero/composer-actions";
import type { FumeroComposerModelTier } from "@/lib/fumero/composer-model-tier";

export const FUMERO_CMD_EVENTS = {
  newChat: "fumero-cmd-new-chat",
  focusComposer: "fumero-cmd-focus-composer",
  setComposerMode: "fumero-cmd-set-composer-mode",
  openConnectors: "fumero-cmd-open-connectors",
  cycleModelTier: "fumero-cmd-cycle-model-tier",
  openBriefing: "fumero-cmd-open-briefing",
  openStudioOverview: "fumero-cmd-open-studio-overview",
  toggleSidebar: "fumero-cmd-toggle-sidebar",
} as const;

export type FumeroCmdSetComposerModeDetail = {
  mode: FumeroComposerMode;
  prompt?: string;
  navigate?: string;
};

export type FumeroCmdCycleModelTierDetail = {
  tier?: FumeroComposerModelTier;
};

export type FumeroCmdFocusComposerDetail = {
  prompt?: string;
};

export function dispatchFumeroCmd(
  event: (typeof FUMERO_CMD_EVENTS)[keyof typeof FUMERO_CMD_EVENTS],
  detail?: unknown
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(event, { detail }));
}
