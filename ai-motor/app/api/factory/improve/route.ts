import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram";
import { callFactoryN8n, extractMessage } from "@/lib/chat-n8n";

export const runtime = "nodejs";

const TYPE_LABELS: Record<string, string> = {
  bug: "Bug fix nodig",
  feature: "Nieuwe feature",
  improvement: "Verbetering",
  content: "Content taak",
};

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, beschrijving, prioriteit = "normaal" } = body as {
    type?: string;
    beschrijving?: string;
    prioriteit?: string;
  };

  if (!beschrijving || typeof beschrijving !== "string") {
    return NextResponse.json(
      { error: "beschrijving required" },
      { status: 400 }
    );
  }

  const label = TYPE_LABELS[type ?? ""] ?? "Taak";

  const prompt = `${label}: ${beschrijving.trim()}\n\nAnalyseer wat er nodig is. Optioneel: voeg een regel toe voor POST /api/cursor-tasks met task + section.`;

  const { ok, status, data, rawText } = await callFactoryN8n({
    prompt,
    klant: "system",
    afdeling: "fabriek",
    type: "self_improve",
  });

  void sendTelegramMessage(
    `Factory OS — ${label}\n${beschrijving.trim()}\nPrioriteit: ${prioriteit}`
  );

  if (!ok) {
    return NextResponse.json(
      {
        message: "Telegram verstuurd; n8n-fout",
        error: `n8n error: ${status}`,
        detail: rawText.slice(0, 500),
      },
      { status: 502 }
    );
  }

  const factory_response = extractMessage(data);

  return NextResponse.json({
    message: "Verbetering aangevraagd",
    factory_response,
  });
}
