import type { FumeroLivePreviewPayload } from "@/lib/fumero/content-preview";
import type { ProjectRuntime } from "@/lib/fumero/project-runtime";

export type BouwenSaveState = "unavailable" | "saving" | "saved";

export type BouwenChatConversation = {
  id: number;
  title: string;
};

/** State bridge tussen MotorsChatPanel en FumeroBouwenShell topbar. */
export type FumeroBouwenBridge = {
  /** True zodra er gebouwd wordt of preview-inhoud bestaat — split-paneel tonen. */
  buildActive: boolean;
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
  saveState: BouwenSaveState;
  publishBusy: boolean;
  publishError: string | null;
  newChat: () => Promise<void>;
  chatControlsDisabled: boolean;
  conversations: BouwenChatConversation[];
  activeConversationId: number | undefined;
  selectConversation: (id: number) => void;
};

export const EMPTY_BOUWEN_BRIDGE: FumeroBouwenBridge = {
  buildActive: false,
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
  saveState: "unavailable",
  publishBusy: false,
  publishError: null,
  newChat: async () => {},
  chatControlsDisabled: true,
  conversations: [],
  activeConversationId: undefined,
  selectConversation: () => {},
};
