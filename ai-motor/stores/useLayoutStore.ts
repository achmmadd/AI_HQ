import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type LayoutState = {
  /** Hoofdnavigatie (Factory OS links) */
  navCollapsed: boolean;
  toggleNavCollapsed: () => void;
  setNavCollapsed: (v: boolean) => void;
  /** Fumero Studio sidebar (desktop expanded ↔ icon-only) */
  fumeroSidebarCollapsed: boolean;
  toggleFumeroSidebarCollapsed: () => void;
  setFumeroSidebarCollapsed: (v: boolean) => void;
  /** Gesprekken-lijst in chat */
  chatThreadsOpen: boolean;
  toggleChatThreads: () => void;
  setChatThreadsOpen: (v: boolean) => void;
  /** Rechter preview (artifact / project) */
  previewPanelOpen: boolean;
  togglePreviewPanel: () => void;
  setPreviewPanelOpen: (v: boolean) => void;
  /** Context paneel in chat (agent, automations, docs) */
  contextPanelOpen: boolean;
  toggleContextPanel: () => void;
  setContextPanelOpen: (v: boolean) => void;
  /** motor_pro = Turbo (browser/automation) */
  motorChatMode: "motor" | "motor_pro";
  setMotorChatMode: (m: "motor" | "motor_pro") => void;
  /** Eerst plan, dan uitvoeren */
  planMode: boolean;
  setPlanMode: (v: boolean) => void;
  togglePlanMode: () => void;
};

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      navCollapsed: false,
      toggleNavCollapsed: () =>
        set((s) => ({ navCollapsed: !s.navCollapsed })),
      setNavCollapsed: (navCollapsed) => set({ navCollapsed }),

      fumeroSidebarCollapsed: false,
      toggleFumeroSidebarCollapsed: () =>
        set((s) => ({ fumeroSidebarCollapsed: !s.fumeroSidebarCollapsed })),
      setFumeroSidebarCollapsed: (fumeroSidebarCollapsed) =>
        set({ fumeroSidebarCollapsed }),

      chatThreadsOpen: true,
      toggleChatThreads: () =>
        set((s) => ({ chatThreadsOpen: !s.chatThreadsOpen })),
      setChatThreadsOpen: (chatThreadsOpen) => set({ chatThreadsOpen }),

      previewPanelOpen: true,
      togglePreviewPanel: () =>
        set((s) => ({ previewPanelOpen: !s.previewPanelOpen })),
      setPreviewPanelOpen: (previewPanelOpen) => set({ previewPanelOpen }),

      contextPanelOpen: true,
      toggleContextPanel: () =>
        set((s) => ({ contextPanelOpen: !s.contextPanelOpen })),
      setContextPanelOpen: (contextPanelOpen) => set({ contextPanelOpen }),

      motorChatMode: "motor",
      setMotorChatMode: (motorChatMode) => set({ motorChatMode }),

      planMode: false,
      setPlanMode: (planMode) => set({ planMode }),
      togglePlanMode: () => set((s) => ({ planMode: !s.planMode })),
    }),
    {
      name: "motorsai-layout",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        navCollapsed: s.navCollapsed,
        fumeroSidebarCollapsed: s.fumeroSidebarCollapsed,
        chatThreadsOpen: s.chatThreadsOpen,
        previewPanelOpen: s.previewPanelOpen,
        contextPanelOpen: s.contextPanelOpen,
        motorChatMode: s.motorChatMode,
        planMode: s.planMode,
      }),
    }
  )
);

/** Breedte hoofdnav (px) — synchroon met Tailwind classes */
export const NAV_WIDTH_EXPANDED = 220;
export const NAV_WIDTH_COLLAPSED = 56; // w-14
