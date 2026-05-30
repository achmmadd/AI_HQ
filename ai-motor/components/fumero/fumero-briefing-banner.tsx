"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fumeroChatWorkspaceUrl } from "@/lib/fumero-quick-actions";

type Briefing = {
  summary?: string;
  actions?: string[];
  opportunities?: string[];
  status?: string[];
};

export function FumeroBriefingBanner() {
  const router = useRouter();
  const [briefing, setBriefing] = useState<Briefing | null>(null);

  useEffect(() => {
    void fetch("/api/fumero/briefing", { credentials: "include" })
      .then((r) => r.json())
      .then((j) => setBriefing(j as Briefing))
      .catch(() => setBriefing(null));
  }, []);

  if (!briefing?.summary) return null;

  const blocks = [
    { title: "Acties", items: briefing.actions ?? [], clickable: true },
    { title: "Kansen", items: briefing.opportunities ?? [], clickable: true },
    { title: "Status", items: briefing.status ?? [], clickable: false },
  ].filter((b) => b.items.length > 0);

  return (
    <div className="ai-result mb-4">
      <div className="ai-result-header">
        <span className="ai-result-from">Max · briefing</span>
      </div>
      <div className="ai-result-body">
        <p className="mb-2 font-medium">{briefing.summary}</p>
        {blocks.map((sec) => (
          <div key={sec.title} className="mb-2">
            <p className="text-xs font-bold uppercase text-[var(--accent)]">{sec.title}</p>
            <ul className="mt-1 list-none pl-0 text-sm">
              {sec.items.map((item) => (
                <li key={item}>
                  {sec.clickable ? (
                    <button
                      type="button"
                      className="text-left text-[var(--text)] underline-offset-2 hover:text-[var(--accent)] hover:underline"
                      onClick={() => router.push(fumeroChatWorkspaceUrl(item))}
                    >
                      {item}
                    </button>
                  ) : (
                    <span>{item}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
