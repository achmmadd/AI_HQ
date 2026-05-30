"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Hammer, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompanyStore } from "@/stores/useCompanyStore";
import { fetchJsonChecked } from "@/lib/fetch-json-client";
import { cn } from "@/lib/utils";

type MyWorkItem = {
  kind: "linked" | "project" | "app";
  title: string;
  slug: string;
  klant: string;
  updated_at: string;
  build_project_id: number | null;
  custom_app_id: number | null;
  stack: string | null;
  status: string | null;
};

export function MotorsMyWork() {
  const company = useCompanyStore((s) => s.company);
  const [items, setItems] = useState<MyWorkItem[]>([]);

  const load = useCallback(() => {
    const q = company ? `?klant=${encodeURIComponent(company)}` : "";
    fetchJsonChecked<{ items?: MyWorkItem[] }>(`/api/my-work${q}`, {
      credentials: "include",
    })
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }, [company]);

  useEffect(() => {
    load();
  }, [load]);

  const deleteApp = async (slug: string, title: string) => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(`“${title}” verwijderen?`)
    ) {
      return;
    }
    await fetch(`/api/apps/${slug}`, {
      method: "DELETE",
      credentials: "include",
    });
    load();
  };

  return (
    <div className="ios-fade-up mx-auto flex min-h-0 max-w-xl flex-col gap-4">
      <div className="flex flex-col gap-3">
        <h2 className="text-[20px] font-semibold tracking-tight text-text-primary">
          Mijn werk
        </h2>
        <p className="text-[15px] leading-snug text-text-secondary">
          Apps en projecten op één plek. Open live, of ga verder bouwen in chat —
          MotorsAI onthoudt waar je was gebleven.
        </p>
        <Button
          asChild
          className="ios-tap-highlight h-12 w-full rounded-2xl text-[15px] font-semibold shadow-none md:w-auto md:self-start"
        >
          <Link href="/chat" prefetch={false}>
            <Hammer className="mr-2 h-[18px] w-[18px]" aria-hidden />
            Nieuw in chat
          </Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-border/70 bg-surface/80 p-8 text-center">
          <p className="text-[15px] text-text-secondary">Nog geen werk opgeslagen.</p>
          <Button asChild className="ios-tap-highlight mt-5 h-12 rounded-2xl px-8">
            <Link href="/chat" prefetch={false}>
              Start in chat
            </Link>
          </Button>
        </div>
      ) : (
        <ul
          role="list"
          className="overflow-hidden rounded-2xl border border-border/70 bg-surface/80 shadow-none"
        >
          {items.map((item, i) => (
            <li
              key={`${item.kind}-${item.slug}-${item.build_project_id ?? "a"}`}
              className={cn(
                "flex min-h-[64px] flex-col gap-2 px-4 py-3.5",
                i > 0 && "border-t border-border/65"
              )}
            >
              <div className="flex min-w-0 items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[16px] font-semibold text-text-primary">
                    {item.title}
                  </p>
                  <p className="mt-0.5 truncate text-[13px] text-text-secondary">
                    {item.stack ? `${item.stack} · ` : ""}
                    {item.kind === "project" ? "Alleen project" : "Live app"}
                    <span className="mx-2 text-border">·</span>
                    {new Date(item.updated_at).toLocaleString("nl-NL", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  {item.build_project_id != null && (
                    <Button
                      variant="secondary"
                      asChild
                      className="ios-tap-highlight h-10 rounded-xl px-3 text-xs font-medium"
                    >
                      <Link
                        href={`/chat?project=${item.build_project_id}`}
                        prefetch={false}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" />
                        Verder bouwen
                      </Link>
                    </Button>
                  )}
                  {(item.kind === "linked" || item.kind === "app") && (
                    <Button
                      variant="secondary"
                      asChild
                      className="ios-tap-highlight h-10 w-10 rounded-xl p-0"
                    >
                      <a
                        href={`/apps/${item.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open live"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {item.custom_app_id != null && (
                    <Button
                      variant="secondary"
                      className="ios-tap-highlight h-10 w-10 rounded-xl p-0 text-error hover:bg-error/15"
                      type="button"
                      onClick={() => void deleteApp(item.slug, item.title)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
