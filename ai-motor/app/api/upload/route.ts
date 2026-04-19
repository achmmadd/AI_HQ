import { NextRequest, NextResponse } from "next/server";
import { mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import path from "path";
import db from "@/lib/db/database";

export const runtime = "nodejs";

const N8N_WEBHOOK =
  process.env.N8N_FACTORY_OS_WEBHOOK ||
  "http://127.0.0.1:5678/webhook/factory-os";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const klantRaw = formData.get("klant");
    const klant =
      typeof klantRaw === "string" && klantRaw ? klantRaw : "algemeen";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "no file" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const filename = `${Date.now()}_${safeName}`;
    const home = process.env.HOME || "/home/pietje";
    const uploadDir = path.join(home, "AI_HQ", "uploads");
    mkdirSync(uploadDir, { recursive: true });
    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, buffer);

    let analysis = "Bestand opgeslagen";
    try {
      const analysisRes = await fetch(N8N_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Analyseer dit bestand (naam: ${file.name}). Geef een korte samenvatting.`,
          klant,
          afdeling: "research",
          filename: file.name,
          file_type: file.type,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      if (analysisRes.ok) {
        const raw = await analysisRes.text();
        let data: Record<string, unknown>;
        try {
          data = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          data = { output: raw };
        }
        const out =
          (typeof data.output === "string" && data.output) ||
          (typeof data.answer === "string" && data.answer) ||
          (typeof data.message === "string" && data.message) ||
          analysis;
        analysis = out;
      }
    } catch {
      /* n8n optioneel */
    }

    db.prepare(
      `INSERT INTO uploads (filename, filepath, klant, analysis)
       VALUES (?, ?, ?, ?)`
    ).run(filename, filepath, klant, analysis);

    return NextResponse.json({
      filename,
      analysis,
      message: "Bestand geüpload",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
