"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { bokasChatWorkspaceUrl } from "@/lib/bokas-quick-actions";

const QUICK_ACTIONS = [
  {
    icon: "🍽",
    title: "Reserveringen overzicht",
    desc: "Vandaag en morgen in de chat bespreken",
    href: bokasChatWorkspaceUrl(
      "Geef een overzicht van alle reserveringen voor vandaag en morgen."
    ),
  },
  {
    icon: "📋",
    title: "Menu & specials",
    desc: "Suggesties voor het menu of dagprijzen",
    href: bokasChatWorkspaceUrl(
      "Help me met 3 nieuwe specials voor het menu deze week."
    ),
  },
  {
    icon: "👥",
    title: "Personeel & shifts",
    desc: "Planning en diensten",
    href: bokasChatWorkspaceUrl(
      "Controleer de personeelsplanning en geef verbeterpunten voor het weekend."
    ),
  },
  {
    icon: "📱",
    title: "Social content",
    desc: "Posts voor Instagram of Facebook",
    href: bokasChatWorkspaceUrl(
      "Schrijf een Instagram-post om tafels te vullen op vrijdagavond."
    ),
  },
];

export function BokasAiAssistent() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = useCallback(() => {
    const q = prompt.trim();
    if (!q) return;
    setBusy(true);
    router.push(bokasChatWorkspaceUrl(q));
  }, [prompt, router]);

  return (
    <div className="ai-center">
      <h1 className="ai-greeting">
        Wat regelen we voor <em>Bokas</em>?
      </h1>
      <p className="ai-sub">
        Reserveringen, menu, team of marketing — Bas helpt je direct verder.
      </p>

      <div className="ai-composer">
        <div className="ai-composer-top">
          <div className="ai-composer-label">✦ Vraag Bas</div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Hoeveel covers verwachten we zaterdag avond en wie draait de bar?"
            rows={4}
            disabled={busy}
          />
        </div>
        <div className="ai-composer-bottom">
          <button
            type="button"
            className="composer-send"
            onClick={submit}
            disabled={busy || !prompt.trim()}
            aria-label="Versturen"
          >
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
      <p className="text-center text-xs text-[var(--text-secondary)]">
        Enter = chat · Shift+Enter = nieuwe regel
      </p>

      <p className="quick-label">Snelle acties</p>
      <div className="quick-grid">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.href}
            type="button"
            className="quick-card text-left"
            disabled={busy}
            onClick={() => {
              setBusy(true);
              router.push(action.href);
            }}
          >
            <div className="quick-icon">{action.icon}</div>
            <div className="quick-title">{action.title}</div>
            <div className="quick-desc">{action.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
