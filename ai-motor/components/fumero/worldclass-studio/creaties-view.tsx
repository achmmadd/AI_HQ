"use client";

import type { usePhotoStudioGeneration } from "@/hooks/use-photo-studio-generation";
import type { CompanyId } from "@/lib/types";

type Gen = ReturnType<typeof usePhotoStudioGeneration>;

type Props = {
  klant: CompanyId;
  studio: Gen;
};

export function CreatiesView({ studio }: Props) {
  const { items, refreshLibrary } = studio;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--wc-border)] bg-[var(--fumero-surface)]">
      <div className="flex items-center justify-between border-b border-[var(--wc-border)] px-4 py-3">
        <h2 className="text-[15px] font-semibold text-[var(--fumero-text)]">
          Creaties
        </h2>
        <button
          type="button"
          onClick={refreshLibrary}
          className="text-[12px] font-medium text-[var(--wc-accent)] hover:underline"
        >
          Vernieuwen
        </button>
      </div>
      <div className="grid flex-1 gap-3 overflow-y-auto p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.length === 0 ? (
          <p className="col-span-full text-center text-[13px] text-[var(--wc-text-muted)]">
            Nog geen creaties — ga naar Maken om te starten.
          </p>
        ) : (
          items.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-xl border border-[var(--wc-border)] bg-[var(--fumero-surface)]"
            >
              {item.media_type === "video" ? (
                <video
                  src={item.master_url}
                  className="aspect-square w-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.master_url}
                  alt=""
                  className="aspect-square w-full object-cover"
                />
              )}
              <p className="line-clamp-2 px-2 py-1.5 text-[11px] text-[var(--wc-text-muted)]">
                {item.user_prompt || "Zonder prompt"}
              </p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
