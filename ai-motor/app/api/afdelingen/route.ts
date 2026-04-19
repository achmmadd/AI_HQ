import { NextResponse } from "next/server";

export const runtime = "nodejs";

const AFDELINGEN = [
  {
    id: "research",
    naam: "@research",
    icon: "🔍",
    beschrijving: "Marktonderzoek en analyse",
    model: "DeepSeek V3",
    klanten: ["fumero", "bokas"],
  },
  {
    id: "marketing",
    naam: "@marketing",
    icon: "📣",
    beschrijving: "Content en campagnes",
    model: "Claude Haiku",
    klanten: ["fumero", "bokas"],
  },
  {
    id: "finance",
    naam: "@finance",
    icon: "💰",
    beschrijving: "Kosten en facturen",
    model: "DeepSeek V3",
    klanten: ["fumero", "bokas"],
  },
  {
    id: "fabriek",
    naam: "@fabriek",
    icon: "🏗️",
    beschrijving: "Cursor builder agent",
    model: "Claude Sonnet",
    klanten: ["system"],
  },
  {
    id: "content",
    naam: "@content",
    icon: "✍️",
    beschrijving: "Teksten en posts",
    model: "Claude Haiku",
    klanten: ["fumero", "bokas"],
  },
  {
    id: "strategy",
    naam: "@strategy",
    icon: "♟️",
    beschrijving: "Strategie en planning",
    model: "Claude Sonnet",
    klanten: ["fumero", "bokas"],
  },
  {
    id: "bibliothecaris",
    naam: "@bibliothecaris",
    icon: "📚",
    beschrijving: "Kennisbank bijhouden",
    model: "Ollama lokaal",
    klanten: ["system"],
  },
  {
    id: "bokas-agent",
    naam: "@bokas",
    icon: "🍽️",
    beschrijving: "Horeca en Bokas",
    model: "Claude Haiku",
    klanten: ["bokas"],
  },
  {
    id: "fumero-agent",
    naam: "@fumero",
    icon: "🌿",
    beschrijving: "Fumero merk en support",
    model: "Claude Haiku",
    klanten: ["fumero"],
  },
];

async function checkN8N(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:5678/healthz", {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function checkOllama(): Promise<boolean> {
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    return res.status < 500;
  } catch {
    return false;
  }
}

export async function GET() {
  const [n8nOnline, ollamaOnline] = await Promise.all([
    checkN8N(),
    checkOllama(),
  ]);

  const afdelingen = AFDELINGEN.map((a) => ({
    ...a,
    status: n8nOnline ? "actief" : "offline",
    ollama: ollamaOnline,
    laatste_activiteit: new Date().toISOString(),
    taken_vandaag: Math.floor(Math.random() * 10),
    kosten_vandaag: (Math.random() * 0.5).toFixed(3),
  }));

  return NextResponse.json({
    afdelingen,
    n8n_online: n8nOnline,
    services: { n8n: n8nOnline, ollama: ollamaOnline },
  });
}
