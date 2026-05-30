"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown, MoreHorizontal, Plus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FUMERO_COMPOSER_MENU_SECTIONS,
  FUMERO_COMPOSER_MODE_META,
  menuItemIdToComposerMode,
  type FumeroComposerMenuAction,
  type FumeroComposerMenuItem,
  type FumeroComposerMode,
} from "@/lib/fumero/composer-actions";
import {
  FUMERO_MODEL_TIERS,
  writeStoredFumeroModelTier,
  type FumeroComposerModelTier,
} from "@/lib/fumero/composer-model-tier";

export type { FumeroComposerMenuAction, FumeroComposerMode };

export type FumeroCoderOverflowItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  href?: string;
};

type PopoverAnchor = { left: number; bottom: number; width: number };

function ComposerPopover({
  open,
  anchorRef,
  align,
  children,
  className,
  role,
  ariaLabel,
  popoverRef,
}: {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  align: "left" | "right";
  children: ReactNode;
  className?: string;
  role?: string;
  ariaLabel?: string;
  popoverRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);

  const updateAnchor = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setAnchor({
      left: align === "right" ? rect.right : rect.left,
      bottom: window.innerHeight - rect.top + 8,
      width: rect.width,
    });
  }, [align, anchorRef]);

  useLayoutEffect(() => {
    if (!open) {
      setAnchor(null);
      return;
    }
    updateAnchor();
    window.addEventListener("resize", updateAnchor);
    window.addEventListener("scroll", updateAnchor, true);
    return () => {
      window.removeEventListener("resize", updateAnchor);
      window.removeEventListener("scroll", updateAnchor, true);
    };
  }, [open, updateAnchor]);

  if (!open || !anchor || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={popoverRef}
      role={role}
      aria-label={ariaLabel}
      style={{
        position: "fixed",
        left: align === "right" ? undefined : anchor.left,
        right:
          align === "right"
            ? Math.max(8, window.innerWidth - anchor.left)
            : undefined,
        bottom: anchor.bottom,
        zIndex: 9999,
      }}
      className={cn(
        "fumero-composer-popover pointer-events-auto overflow-hidden rounded-2xl border border-[#E5E5E5] bg-white py-2 shadow-xl",
        className
      )}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
}

export function FumeroComposerToolbar({
  modelTier,
  onModelTierChange,
  onMenuAction,
  onPrefill,
  composerMode = "default",
  onComposerModeChange,
  onUploadClick,
  onConnectorsOpen,
  children,
  disabled,
  coderExtras,
  coderOverflowItems,
  variant = "bar",
}: {
  modelTier: FumeroComposerModelTier;
  onModelTierChange: (tier: FumeroComposerModelTier) => void;
  onMenuAction: (action: FumeroComposerMenuAction) => void;
  onPrefill?: (text: string) => void;
  composerMode?: FumeroComposerMode;
  onComposerModeChange?: (mode: FumeroComposerMode) => void;
  onUploadClick?: () => void;
  onConnectorsOpen?: () => void;
  children?: ReactNode;
  disabled?: boolean;
  /** Coder-only overflow actions (Plan, Visual edits, etc.) — max 2 visible pills (mode + model). */
  coderOverflowItems?: FumeroCoderOverflowItem[];
  /** @deprecated Use coderOverflowItems */
  coderExtras?: ReactNode;
  /** `inline` = chrome row inside Gemini composer shell */
  variant?: "bar" | "inline";
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const modelButtonRef = useRef<HTMLButtonElement>(null);
  const overflowButtonRef = useRef<HTMLButtonElement>(null);
  const menuPopoverRef = useRef<HTMLDivElement>(null);
  const modelPopoverRef = useRef<HTMLDivElement>(null);
  const overflowPopoverRef = useRef<HTMLDivElement>(null);

  const closeMenus = useCallback(() => {
    setMenuOpen(false);
    setModelOpen(false);
    setOverflowOpen(false);
  }, []);

  useEffect(() => {
    if (!menuOpen && !modelOpen && !overflowOpen) return;

    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      const inMenu =
        menuButtonRef.current?.contains(t) ||
        menuPopoverRef.current?.contains(t);
      const inModel =
        modelButtonRef.current?.contains(t) ||
        modelPopoverRef.current?.contains(t);
      const inOverflow =
        overflowButtonRef.current?.contains(t) ||
        overflowPopoverRef.current?.contains(t);
      if (menuOpen && !inMenu) setMenuOpen(false);
      if (modelOpen && !inModel) setModelOpen(false);
      if (overflowOpen && !inOverflow) setOverflowOpen(false);
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMenus();
    };

    document.addEventListener("click", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [closeMenus, menuOpen, modelOpen, overflowOpen]);

  const pickTier = useCallback(
    (tier: FumeroComposerModelTier) => {
      writeStoredFumeroModelTier(tier);
      onModelTierChange(tier);
      setModelOpen(false);
    },
    [onModelTierChange]
  );

  const activeTier = FUMERO_MODEL_TIERS.find((t) => t.id === modelTier)!;
  const activeModeMeta =
    composerMode !== "default" ? FUMERO_COMPOSER_MODE_META[composerMode] : null;
  const ModeIcon = activeModeMeta?.icon;

  const handleMenuPick = (item: FumeroComposerMenuItem) => {
    if (item.disabled) return;
    setMenuOpen(false);
    const mode = menuItemIdToComposerMode(item.id);
    if (mode) onComposerModeChange?.(mode);
    if (item.action.kind === "upload") {
      onUploadClick?.();
      return;
    }
    if (item.action.kind === "research") {
      onMenuAction(item.action);
      onPrefill?.("Zoek op het web naar ");
      return;
    }
    if (item.action.kind === "connectors") {
      onConnectorsOpen?.();
      return;
    }
    onMenuAction(item.action);
  };

  const handleModePillClick = () => {
    if (composerMode !== "default") {
      onComposerModeChange?.("default");
    }
  };

  const menuPanel = menuOpen ? (
    <ComposerPopover
      open={menuOpen}
      anchorRef={menuButtonRef}
      align="left"
      role="menu"
      popoverRef={menuPopoverRef}
      className="w-[min(19rem,calc(100vw-2rem))]"
    >
        {FUMERO_COMPOSER_MENU_SECTIONS.map((section, si) => (
          <div key={section.id}>
            {si > 0 ? (
              <div className="mx-3 my-1.5 border-t border-[#E5E5E5]" />
            ) : null}
            <p className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#a3a3a3]">
              {section.label}
            </p>
            {section.items.map((item) => {
              const Icon = item.icon;
              const itemMode = menuItemIdToComposerMode(item.id);
              const isActive = itemMode && itemMode === composerMode;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled || disabled}
                  className={cn(
                    "flex w-full items-start gap-3 px-3 py-2 text-left transition-colors hover:bg-[#FAFAFA] focus-visible:bg-[#FAFAFA] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45",
                    isActive && "bg-[rgba(105,196,0,0.06)]"
                  )}
                  onClick={() => handleMenuPick(item)}
                >
                  <Icon
                    className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      item.disabled ? "text-[#a3a3a3]" : "text-[#69C400]"
                    )}
                    strokeWidth={1.75}
                  />
                  <span>
                    <span className="block text-[13px] font-medium text-[#171717]">
                      {item.label}
                    </span>
                    <span className="block text-[11px] leading-snug text-[#737373]">
                      {item.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </ComposerPopover>
  ) : null;

  const modelPanel = modelOpen ? (
    <ComposerPopover
      open={modelOpen}
      anchorRef={modelButtonRef}
      align="right"
      role="listbox"
      ariaLabel="Model kiezen"
      popoverRef={modelPopoverRef}
      className="w-56 py-1"
    >
        {FUMERO_MODEL_TIERS.map((tier) => (
          <button
            key={tier.id}
            type="button"
            role="option"
            aria-selected={tier.id === modelTier}
            className={cn(
              "flex w-full flex-col items-start px-3 py-2.5 text-left transition-colors hover:bg-[#FAFAFA] focus-visible:bg-[#FAFAFA] focus-visible:outline-none",
              tier.id === modelTier && "bg-[rgba(105,196,0,0.06)]"
            )}
            onClick={() => pickTier(tier.id)}
          >
            <span
              className={cn(
                "text-[13px] font-medium",
                tier.id === modelTier ? "text-[#69C400]" : "text-[#171717]"
              )}
            >
              {tier.label}
            </span>
            <span className="text-[11px] text-[#737373]">{tier.description}</span>
          </button>
        ))}
      </ComposerPopover>
  ) : null;

  const overflowPanel =
    overflowOpen && coderOverflowItems && coderOverflowItems.length > 0 ? (
      <ComposerPopover
        open={overflowOpen}
        anchorRef={overflowButtonRef}
        align="left"
        role="menu"
        popoverRef={overflowPopoverRef}
        className="w-52 py-1"
      >
        {coderOverflowItems.map((item) => {
          const Icon = item.icon;
          const className = cn(
            "flex w-full items-center gap-2 px-3 py-2 text-left fumero-text-body-sm transition-colors hover:bg-[var(--fumero-bg)] focus-visible:bg-[var(--fumero-bg)] focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45",
            item.active && "bg-[var(--fumero-accent-muted)] font-medium"
          );
          if (item.href) {
            return (
              <a
                key={item.id}
                href={item.href}
                role="menuitem"
                className={className}
                onClick={() => setOverflowOpen(false)}
              >
                {Icon ? <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} /> : null}
                {item.label}
              </a>
            );
          }
          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled || disabled}
              className={className}
              onClick={() => {
                setOverflowOpen(false);
                item.onClick();
              }}
            >
              {Icon ? <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} /> : null}
              {item.label}
            </button>
          );
        })}
      </ComposerPopover>
    ) : null;

  const leftControls = (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      <div className="relative">
        <button
          ref={menuButtonRef}
          type="button"
          disabled={disabled}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          title="Acties — foto, canvas, coder, online"
          onClick={() => {
            setMenuOpen((o) => !o);
            setModelOpen(false);
            setOverflowOpen(false);
          }}
          className={cn(
            "fumero-composer-plus ios-tap-highlight inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#E5E5E5] bg-white text-[#525252] transition-colors hover:border-[#69C400]/40 hover:bg-[#FAFAFA] hover:text-[#171717] disabled:opacity-40",
            menuOpen && "border-[#69C400]/50 bg-[rgba(105,196,0,0.06)] text-[#69C400]"
          )}
        >
          <Plus className="h-4 w-4" />
        </button>
        {menuPanel}
      </div>

      {activeModeMeta && ModeIcon && onComposerModeChange ? (
        <button
          type="button"
          disabled={disabled}
          onClick={handleModePillClick}
          className={cn(
            "fumero-mode-pill ios-tap-highlight inline-flex items-center gap-1 rounded-full border px-2.5 py-1 fumero-text-caption font-medium transition-all duration-150 disabled:opacity-40",
            "border-[#69C400]/50 bg-[rgba(105,196,0,0.1)] text-[#3d7a00] hover:border-[#69C400]/65 hover:bg-[rgba(105,196,0,0.14)]"
          )}
          aria-pressed
          title={`${activeModeMeta.label} — klik om uit te schakelen`}
        >
          <ModeIcon className="h-3.5 w-3.5 shrink-0" />
          {activeModeMeta.label}
          <X className="ml-0.5 h-3 w-3 shrink-0 opacity-50" aria-hidden />
        </button>
      ) : null}

      {coderOverflowItems && coderOverflowItems.length > 0 ? (
        <div className="relative">
          <button
            ref={overflowButtonRef}
            type="button"
            disabled={disabled}
            aria-expanded={overflowOpen}
            aria-haspopup="menu"
            title="Meer opties"
            onClick={() => {
              setOverflowOpen((o) => !o);
              setMenuOpen(false);
              setModelOpen(false);
            }}
            className={cn(
              "ios-tap-highlight inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--fumero-border)] bg-white text-[var(--fumero-text-muted)] transition-colors hover:border-[var(--fumero-accent)]/40 hover:text-[var(--fumero-text)] disabled:opacity-40",
              overflowOpen && "border-[var(--fumero-accent)]/50 bg-[var(--fumero-accent-muted)]"
            )}
          >
            <MoreHorizontal className="h-4 w-4" strokeWidth={1.5} />
          </button>
          {overflowPanel}
        </div>
      ) : (
        coderExtras
      )}
    </div>
  );

  const modelControl = (
    <div className="relative">
      <button
        ref={modelButtonRef}
        type="button"
        disabled={disabled}
        aria-expanded={modelOpen}
        aria-haspopup="listbox"
        onClick={() => {
          setModelOpen((o) => !o);
          setMenuOpen(false);
        }}
        className={cn(
          "fumero-model-pill ios-tap-highlight inline-flex max-w-[10rem] items-center gap-1 rounded-full border border-[var(--fumero-border)] bg-white px-2.5 py-1 fumero-text-caption font-medium text-[var(--fumero-text-muted)] transition-colors hover:border-[var(--fumero-accent)]/40 hover:text-[var(--fumero-text)] disabled:opacity-40",
          modelOpen && "border-[#69C400]/50 text-[#69C400]"
        )}
      >
        <span className="truncate">{activeTier.shortLabel}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
      </button>
      {modelPanel}
    </div>
  );

  if (variant === "inline") {
    return (
      <div className="flex w-full flex-wrap items-center justify-between gap-2 px-1 pb-1 pt-0.5">
        {leftControls}
        <div className="flex shrink-0 items-center gap-1.5">
          {modelControl}
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-1 pt-1.5">
      {leftControls}
      <div className="flex shrink-0 items-center gap-1.5">
        {modelControl}
        {children}
      </div>
    </div>
  );
}
