"use client";
import { useCallback, useRef, useState } from "react";
import {
  clampMakerPanelWidth,
  MAKER_PANEL_DEFAULT,
  readMakerPanelWidth,
  writeMakerPanelWidth,
} from "@/lib/fumero/worldclass-studio/resizable-panel-storage";
type Props = { children: React.ReactNode; className?: string };
export function ResizablePanel({ children, className = "" }: Props) {
  const [width, setWidth] = useState(() => readMakerPanelWidth());
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(MAKER_PANEL_DEFAULT);
  const rafId = useRef<number | null>(null);
  const pendingWidth = useRef<number | null>(null);
  const applyWidth = useCallback((next: number) => {
    const clamped = clampMakerPanelWidth(next);
    pendingWidth.current = clamped;
    if (rafId.current != null) return;
    rafId.current = window.requestAnimationFrame(() => {
      rafId.current = null;
      if (pendingWidth.current != null) {
        setWidth(pendingWidth.current);
        pendingWidth.current = null;
      }
    });
  }, []);
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragging.current = true;
      startX.current = e.clientX;
      startWidth.current = width;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [width],
  );
  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      const delta = e.clientX - startX.current;
      applyWidth(startWidth.current + delta);
    },
    [applyWidth],
  );
  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      dragging.current = false;
      e.currentTarget.releasePointerCapture(e.pointerId);
      const finalWidth = writeMakerPanelWidth(width);
      setWidth(finalWidth);
    },
    [width],
  );
  const onDoubleClick = useCallback(() => {
    const reset = writeMakerPanelWidth(MAKER_PANEL_DEFAULT);
    setWidth(reset);
  }, []);
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? 20 : 8;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        const next = writeMakerPanelWidth(width - step);
        setWidth(next);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        const next = writeMakerPanelWidth(width + step);
        setWidth(next);
      } else if (e.key === "Home") {
        e.preventDefault();
        const reset = writeMakerPanelWidth(MAKER_PANEL_DEFAULT);
        setWidth(reset);
      }
    },
    [width],
  );
  return (
    <>
      {" "}
      <div
        className={`wc-maker-panel ${className}`}
        style={{ width }}
        data-testid="maker-panel"
      >
        {" "}
        {children}{" "}
      </div>{" "}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Paneelbreedte aanpassen"
        aria-valuemin={280}
        aria-valuemax={460}
        aria-valuenow={width}
        tabIndex={0}
        className="wc-resize-handle"
        data-testid="resize-handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
      />{" "}
    </>
  );
}
