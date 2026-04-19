import { NextRequest, NextResponse } from "next/server";
import { callFactoryN8n } from "@/lib/chat-n8n";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const klant = typeof body?.klant === "string" ? body.klant : "";
  const content = typeof body?.content === "string" ? body.content : "";
  const category =
    typeof body?.category === "string" ? body.category : undefined;
  const source =
    typeof body?.source === "string" ? body.source : "ui";

  if (!klant.trim() || !content.trim()) {
    return NextResponse.json(
      { error: "klant and content required" },
      { status: 400 }
    );
  }

  try {
    const { ok, status, data } = await callFactoryN8n({
      prompt: `Sla dit op in de kennisbank voor ${klant}:\n\n${content.trim()}`,
      klant,
      afdeling: "bibliothecaris",
      type: "knowledge_add",
      category,
      source,
    });

    if (!ok) {
      return NextResponse.json(
        { error: `Factory OS error: ${status}`, detail: data },
        { status: 502 }
      );
    }

    return NextResponse.json({
      message: "Opgeslagen in kennisbank",
      klant,
      category,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
