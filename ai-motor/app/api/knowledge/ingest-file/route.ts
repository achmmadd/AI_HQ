import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import db from "@/lib/db/database";
import { extractDocumentText } from "@/lib/extract-document-text";
import {
  chunkKnowledgeText,
  clampChunkSize,
  type ChunkStrategy,
} from "@/lib/knowledge-chunk";
import { validateKnowledgeText } from "@/lib/knowledge-upload-validate";
import { upsertKnowledgeChunks } from "@/lib/qdrant-ingest";
import { qdrantCollectionForScope } from "@/lib/qdrant-collection";

export const runtime = "nodejs";

const MAX_CHUNKS = 500;

function parseTags(raw: string | null): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

export async function POST(req: NextRequest) {
  let docRowId: number | null = null;

  try {
    const form = await req.formData();
    const file = form.get("file");
    const klantRaw = form.get("klant");
    const klant =
      typeof klantRaw === "string" && (klantRaw === "fumero" || klantRaw === "bokas")
        ? klantRaw
        : null;

    if (!klant) {
      return NextResponse.json(
        { error: "klant moet fumero of bokas zijn (per-klant Qdrant-collectie)." },
        { status: 400 }
      );
    }

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }

    const category =
      typeof form.get("category") === "string"
        ? String(form.get("category")).slice(0, 64)
        : "other";
    const tags = parseTags(
      typeof form.get("tags") === "string" ? String(form.get("tags")) : null
    );
    const strategy = (String(form.get("strategy") || "paragraph") ||
      "paragraph") as ChunkStrategy;
    const safeStrategy: ChunkStrategy = ["paragraph", "sentence", "fixed"].includes(
      strategy
    )
      ? strategy
      : "paragraph";
    const maxChunkChars = clampChunkSize(
      Number(form.get("max_chunk_chars")) || (safeStrategy === "fixed" ? 800 : 1200),
      200,
      4000
    );

    const canonicalSourceRaw =
      typeof form.get("canonical_source") === "string"
        ? String(form.get("canonical_source")).trim().slice(0, 512)
        : "";
    const canonical_source = canonicalSourceRaw || undefined;

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "application/octet-stream";
    let text: string;
    try {
      text = await extractDocumentText(buf, mime, file.name);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const validation = validateKnowledgeText(text);
    if (!validation.ok) {
      return NextResponse.json(
        { error: validation.error, warnings: validation.warnings },
        { status: 400 }
      );
    }

    const content_sha256 = crypto
      .createHash("sha256")
      .update(text, "utf8")
      .digest("hex");

    const dup = db
      .prepare(
        `SELECT id FROM knowledge_documents WHERE klant = ? AND content_sha256 = ?`
      )
      .get(klant, content_sha256) as { id: number } | undefined;
    if (dup) {
      return NextResponse.json(
        {
          error: "near-duplicate",
          message:
            "Dezelfde inhoud is al eerder geïndexeerd voor deze klant (SHA-256 match).",
          duplicate_document_id: dup.id,
        },
        { status: 409 }
      );
    }

    const chunks = chunkKnowledgeText(text, safeStrategy, maxChunkChars);
    if (!chunks.length) {
      return NextResponse.json(
        { error: "Geen chunks na verwerking." },
        { status: 400 }
      );
    }
    if (chunks.length > MAX_CHUNKS) {
      return NextResponse.json(
        {
          error: `Te veel chunks (${chunks.length}); max ${MAX_CHUNKS}. Verhoog chunkgrootte of splits het document.`,
        },
        { status: 400 }
      );
    }

    const collection = qdrantCollectionForScope(klant);

    const ins = db
      .prepare(
        `INSERT INTO knowledge_documents (
          klant, filename, mime, content_sha256, chunk_count, qdrant_collection,
          category, tags_json, warnings_json, strategy, max_chunk_chars, canonical_source
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        klant,
        file.name.slice(0, 512),
        mime.slice(0, 128),
        content_sha256,
        chunks.length,
        collection,
        category,
        JSON.stringify(tags),
        JSON.stringify(validation.warnings),
        safeStrategy,
        maxChunkChars,
        canonical_source ?? null
      );

    docRowId = Number(ins.lastInsertRowid);

    const up = await upsertKnowledgeChunks({
      klant,
      documentId: docRowId,
      chunks,
      basePayload: {
        client: klant,
        category,
        tags,
        source_filename: file.name.slice(0, 512),
        ...(canonical_source ? { canonical_source } : {}),
      },
    });

    if ("error" in up) {
      db.prepare(`DELETE FROM knowledge_documents WHERE id = ?`).run(docRowId);
      return NextResponse.json({ error: up.error }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      document_id: docRowId,
      chunk_count: chunks.length,
      upserted: up.upserted,
      collection: up.collection,
      warnings: validation.warnings,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (docRowId != null) {
      try {
        db.prepare(`DELETE FROM knowledge_documents WHERE id = ?`).run(docRowId);
      } catch {
        /* ignore */
      }
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
