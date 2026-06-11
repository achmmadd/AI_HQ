"use client";

import Link from "next/link";

import { FileText, PenLine } from "lucide-react";

export function CanvasView() {
  return (
    <div className="flex h-full min-h-0 flex-col items-center justify-center rounded-2xl border border-[var(--wc-border)] bg-[var(--fumero-surface)] p-8 text-center">
      {" "}
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--wc-accent-muted)]">
        {" "}
        <PenLine className="h-7 w-7 text-[var(--wc-accent)]" />{" "}
      </div>{" "}
      <h2 className="text-[18px] font-semibold text-[var(--wc-text)]">
        Canvas
      </h2>{" "}
      <p className="mt-2 max-w-sm text-[14px] text-[var(--wc-text-muted)]">
        {" "}
        Schrijf- en documentcanvas is beschikbaar via Fumero Chat. Integratie in
        Studio volgt in een volgende fase.{" "}
      </p>{" "}
      <Link
        href="/fumero/chat?mode=canvas"
        className="wc-btn-primary mt-6 inline-flex"
      >
        {" "}
        <FileText className="h-4 w-4" /> Open Canvas in Chat{" "}
      </Link>{" "}
    </div>
  );
}
