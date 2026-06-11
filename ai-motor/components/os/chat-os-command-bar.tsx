"use client";

import { PanelLeft, PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChatOsCommandBar({
  title,
  sidebarOpen,
  previewOpen,
  showPreviewToggle,
  onToggleSidebar,
  onTogglePreview,
  streaming,
}: {
  title?: string;
  sidebarOpen: boolean;
  previewOpen?: boolean;
  showPreviewToggle?: boolean;
  onToggleSidebar: () => void;
  onTogglePreview?: () => void;
  streaming?: boolean;
}) {
  return (
    <header className="chat-os-command-bar">
      <div className="chat-os-command-bar__left">
        {!sidebarOpen ? (
          <button
            type="button"
            className="chat-os-command-bar__btn"
            title="Gesprekken (⌘B)"
            aria-label="Gesprekken openen"
            onClick={onToggleSidebar}
          >
            <PanelLeft className="h-4 w-4" />
          </button>
        ) : null}
        <div className="min-w-0 flex items-center gap-2">
          {streaming ? (
            <span className="chat-os-command-bar__live-dot os-pulse-dot" aria-hidden />
          ) : null}
          <h1 className="truncate text-[14px] font-medium tracking-tight text-[var(--os-text)]">
            {title ?? "Nieuw gesprek"}
          </h1>
        </div>
      </div>

      {showPreviewToggle && onTogglePreview ? (
        <div className="chat-os-command-bar__actions">
          <button
            type="button"
            className={cn(
              "chat-os-command-bar__btn",
              previewOpen && "chat-os-command-bar__btn--active"
            )}
            title={previewOpen ? "Preview verbergen" : "Preview tonen"}
            aria-label="Preview paneel"
            onClick={onTogglePreview}
          >
            {previewOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </button>
        </div>
      ) : null}
    </header>
  );
}
