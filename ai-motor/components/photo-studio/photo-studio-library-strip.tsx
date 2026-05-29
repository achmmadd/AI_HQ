"use client";

import { useCallback, useEffect, useState } from "react";
import type { CompanyId } from "@/lib/types";

type LibraryItem = {
  id: number;
  tracking_id: string;
  prompt: string;
  master_url: string;
  created_at: string;
  variants: Array<{ aspect: string; public_url: string }>;
};

type Props = {
  klant: CompanyId;
  refreshKey?: number;
};

export function PhotoStudioLibraryStrip({ klant, refreshKey = 0 }: Props) {
  const [items, setItems] = useState<LibraryItem[]>([]);

  const load = useCallback(async () => {
    const res = await fetch(`/api/photo-studio/library?klant=${klant}`, {
      credentials: "include",
    });
    const data = (await res.json()) as { items?: LibraryItem[] };
    if (res.ok) setItems(Array.isArray(data.items) ? data.items : []);
  }, [klant]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  if (!items.length) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold text-[#171717]">Bibliotheek</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.slice(0, 6).map((item) => (
          <li
            key={item.id}
            className="flex gap-3 rounded-lg border border-[#E5E5E5] bg-white p-2"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.master_url}
              alt=""
              className="h-14 w-14 shrink-0 rounded object-cover"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-[#525252]">{item.prompt}</p>
              <p className="font-mono text-[10px] text-[#a3a3a3]">{item.tracking_id}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
