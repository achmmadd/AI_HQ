"use client";
import { useEffect, useRef } from "react";
import { CheckCircle2, Clock, Shield } from "lucide-react";
type Props = {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement | null>;
};
export function ControlePopover({ open, onClose, anchorRef }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t))
        return;
      onClose();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, onClose, anchorRef]);
  if (!open) return null;
  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Controle"
      className="wc-glass absolute right-0 top-full z-50 mt-2 w-72 rounded-xl p-3 shadow-[var(--wc-shadow-float)]"
    >
      {" "}
      <p className="mb-2 text-[13px] font-semibold text-[var(--wc-text)]">
        Controle
      </p>{" "}
      <ul className="space-y-2 text-[12px] text-[var(--wc-text-muted)]">
        {" "}
        <li className="flex items-start gap-2">
          {" "}
          <Shield className="mt-0.5 h-4 w-4 shrink-0 text-[var(--wc-accent)]" />{" "}
          <span>
            Merkstijl — optioneel via toggle bij Maken (standaard uit)
          </span>{" "}
        </li>{" "}
        <li className="flex items-start gap-2">
          {" "}
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--wc-text-subtle)]" />{" "}
          <span>
            Goedkeuringen — workflow voorbereid (koppel projectcontext)
          </span>{" "}
        </li>{" "}
        <li className="flex items-start gap-2">
          {" "}
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--wc-text-subtle)]" />{" "}
          <span>
            Versies — beschikbaar via bibliotheek &amp; projecten
          </span>{" "}
        </li>{" "}
      </ul>{" "}
      <p className="mt-3 text-[10px] text-[var(--wc-text-subtle)]">
        {" "}
        Volledige goedkeuringsketen volgt bij projectkoppeling.{" "}
      </p>{" "}
    </div>
  );
}
