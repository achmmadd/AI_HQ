import { NextRequest, NextResponse } from "next/server";
import { mkdirSync } from "fs";
import { writeFile } from "fs/promises";
import path from "path";
import db from "@/lib/db/database";
import { extractDocumentText } from "@/lib/extract-document-text";
import { requireApiAuthSession } from "@/lib/require-api-auth";
import {
  CHAT_UPLOAD_MAX_BYTES,
  CHAT_UPLOAD_MAX_MESSAGE_EXCERPT,
  CHAT_UPLOAD_SKIP_N8N_ANALYSIS_BYTES,
  isChatUploadFileNameAllowed,
  isChatUploadImageFileName,
  truncateForWebhook,
} from "@/lib/chat-upload";

export const runtime = "nodejs";

const N8N_WEBHOOK =
  process.env.N8N_FACTORY_OS_WEBHOOK ||
  "http://127.0.0.1:5678/webhook/factory-os";

function excerptForMessage(text: string): {
  excerpt: string;
  excerpt_truncated: boolean;
} {
  if (text.length <= CHAT_UPLOAD_MAX_MESSAGE_EXCERPT) {
    return { excerpt: text, excerpt_truncated: false };
  }
  return {
    excerpt: text.slice(0, CHAT_UPLOAD_MAX_MESSAGE_EXCERPT),
    excerpt_truncated: true,
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireApiAuthSession(req);
    if (auth instanceof NextResponse) return auth;

    const formData = await req.formData();
    const file = formData.get("file");
    const klantRaw = formData.get("klant");
    const klant =
      typeof klantRaw === "string" && klantRaw ? klantRaw : "algemeen";

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Geen bestand ontvangen." }, { status: 400 });
    }

    if (!isChatUploadFileNameAllowed(file.name)) {
      return NextResponse.json(
        {
          error:
            "Alleen PDF, HTML, TXT, MD, DOCX of afbeeldingen (PNG, JPG, WebP).",
        },
        { status: 400 }
      );
    }

    const isImage = isChatUploadImageFileName(file.name);

    if (file.size > CHAT_UPLOAD_MAX_BYTES) {
      return NextResponse.json(
        {
          error: `Bestand te groot (max ${Math.round(CHAT_UPLOAD_MAX_BYTES / 1024 / 1024)} MB).`,
        },
        { status: 413 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const mime = file.type || "application/octet-stream";

    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const filename = `${Date.now()}_${safeName}`;
    const home = process.env.HOME || "/home/pietje";
    const uploadDir = path.join(home, "AI_HQ", "uploads");
    mkdirSync(uploadDir, { recursive: true });
    const filepath = path.join(uploadDir, filename);
    await writeFile(filepath, buffer);

    if (isImage) {
      const mediaUrl = `/api/upload/file/${encodeURIComponent(filename)}`;
      const analysis = `Afbeelding bijgevoegd (${file.name}, ${Math.round(file.size / 1024)} KB).`;
      db.prepare(
        `INSERT INTO uploads (filename, filepath, klant, analysis)
         VALUES (?, ?, ?, ?)`
      ).run(filename, filepath, klant, analysis);
      return NextResponse.json({
        filename,
        analysis,
        message: "Afbeelding geüpload",
        media_url: mediaUrl,
        media_kind: "image",
        extracted_chars: 0,
      });
    }

    let extracted = "";
    try {
      extracted = await extractDocumentText(buffer, mime, file.name);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    if (!extracted.trim()) {
      return NextResponse.json(
        {
          error:
            "Geen leesbare tekst in dit bestand. Probeer een ander PDF/HTML of een TXT-export.",
        },
        { status: 400 }
      );
    }

    const { text: webhookText, truncated: webhookTruncated } =
      truncateForWebhook(extracted);
    const { excerpt, excerpt_truncated } = excerptForMessage(extracted);

    let analysis =
      extracted.length > 400
        ? `${extracted.slice(0, 400).trim()}…`
        : extracted.trim();

    const skipN8n =
      file.size > CHAT_UPLOAD_SKIP_N8N_ANALYSIS_BYTES ||
      extracted.length > 80_000;

    try {
      if (skipN8n) {
        throw new Error("skip_n8n_fast_path");
      }
      const analysisRes = await fetch(N8N_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Analyseer dit document (bestandsnaam: ${file.name}). Geef een korte samenvatting en noem de belangrijkste punten.`,
          klant,
          afdeling: "research",
          filename: file.name,
          file_type: mime,
          document_text: webhookText,
          document_truncated: webhookTruncated,
          extracted_chars: extracted.length,
        }),
        signal: AbortSignal.timeout(20_000),
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
          null;
        if (out?.trim()) analysis = out.trim();
      }
    } catch (e) {
      if (
        !(e instanceof Error && e.message === "skip_n8n_fast_path") &&
        extracted.length > 500
      ) {
        analysis = `Document ontvangen (${extracted.length.toLocaleString("nl-NL")} tekens). Gebruik het fragment hieronder in je vraag.`;
      }
    }

    db.prepare(
      `INSERT INTO uploads (filename, filepath, klant, analysis)
       VALUES (?, ?, ?, ?)`
    ).run(filename, filepath, klant, analysis);

    return NextResponse.json({
      filename,
      analysis,
      message: "Bestand geüpload",
      extracted_chars: extracted.length,
      excerpt,
      excerpt_truncated,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
