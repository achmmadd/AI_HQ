import type { FumeroLivePreviewPayload } from "@/lib/fumero/content-preview";
import type { ProjectRuntime } from "@/lib/fumero/project-runtime";

/** State bridge tussen MotorsChatPanel en FumeroBouwenShell topbar. */
export type FumeroBouwenBridge = {
  activeToolId: number | null;
  activeAppSlug: string | null;
  canPublish: boolean;
  canUxReview: boolean;
  toolBusy: boolean;
  livePreview: FumeroLivePreviewPayload | null;
  runtime: ProjectRuntime | null;
  publish: () => Promise<void>;
  runUxReview: () => Promise<void>;
  toolSlug: string | null;
  embedCode: string | null;
};

export const EMPTY_BOUWEN_BRIDGE: FumeroBouwenBridge = {
  activeToolId: null,
  activeAppSlug: null,
  canPublish: false,
  canUxReview: false,
  toolBusy: false,
  livePreview: null,
  runtime: null,
  publish: async () => {},
  runUxReview: async () => {},
  toolSlug: null,
  embedCode: null,
};
