import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import db from "@/lib/db/database";
import { ensurePlatformSchema } from "@/lib/db/platform-schema";
import {
  chunkKnowledgeText,
  clampChunkSize,
} from "@/lib/knowledge-chunk";
import { validateKnowledgeText } from "@/lib/knowledge-upload-validate";
import { upsertKnowledgeChunks } from "@/lib/qdrant-ingest";
import { qdrantCollectionForScope } from "@/lib/qdrant-collection";
import type { AuthSession } from "@/lib/auth-session";
import { isMotorsInternalAuthorized } from "@/lib/motors-internal-auth";
import { requireApiAuthForKlant } from "@/lib/require-api-auth";
import { shouldUsePostgres } from "@/lib/db/pg-flags";
import {
  applyPgWorkspaceContext,
  resolveWorkspaceIdBySlug,
} from "@/lib/workspace-context";

export const runtime = "nodejs";

const MAX_CHUNKS = 500;
const KLANTEN = new Set(["fumero", "bokas"]);

function sanitizeFilename(raw: string): string {
  const base = raw
    .trim()
    .replace(/[^\w\s\-_.]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 120);
  return base || "chat-bericht";
}

function defaultTitleFromContent(content: string): string {
  const line = content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean);
  if (!line) return `Chat ${new Date().toISOString().slice(0, 10)}`;
  return line.slice(0, 80);
}

/**
 * Permanent chat → Qdrant ingest + knowledge_documents catalog.
 * Auth: session (cookie / x-motorsai-token / Bearer) OR internal Bearer MOTORS_INTERNAL_TOKEN.
 * OpenClaw: motors__motors_knowledge_save_from_chat — see factory-os/openclaw/motors-tools.json.
 */
export async function POST(req: NextRequest) {
  ensurePlatformSchema();
  let docRowId: number | null = null;

  try {
    const body = await req.json().catch(() => ({}));
    const klantRaw = typeof body?.klant === "string" ? body.klant.trim() : "";
    const klant = KLANTEN.has(klantRaw) ? klantRaw : null;
    const content = typeof body?.content === "string" ? body.content : "";
    const titleRaw =
      typeof body?.title === "string" ? body.title.trim().slice(0, 200) : "";
    const sourceTag =
      typeof body?.source === "string" && body.source.trim()
        ? body.source.trim().slice(0, 32)
        : "chat";

    if (!klant) {
      return NextResponse.json(
        { error: "klant moet fumero of bokas zijn (per-klant Qdrant-collectie)." },
        { status: 400 }
      );
    }

    const internal = isMotorsInternalAuthorized(req);
    let session: AuthSession;

    if (internal) {
      session = {
        userId: null,
        email: "internal@motorsai.local",
        role: "admin",
        scope: "all",
        workspaceSlug: klant,
      };
      if (shouldUsePostgres()) {
        await applyPgWorkspaceContext(session, klant).catch((err) => {
          console.error(
            "[save-from-chat] applyPgWorkspaceContext (internal) failed:",
            err
          );
        });
      }
    } else {
      const auth = await requireApiAuthForKlant(req, klant);
      if (auth instanceof NextResponse) return auth;
      session = auth.session;
    }

    const text = content.trim();
    if (!text) {
      return NextResponse.json({ error: "content required" }, { status: 400 });
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
            "Dezelfde inhoud staat al in de kennisbank voor deze klant (SHA-256 match).",
          documentId: dup.id,
        },
        { status: 409 }
      );
    }

    const maxChunkChars = clampChunkSize(1200, 200, 4000);
    const chunks = chunkKnowledgeText(text, "paragraph", maxChunkChars);
    if (!chunks.length) {
      return NextResponse.json(
        { error: "Geen chunks na verwerking." },
        { status: 400 }
      );
    }
    if (chunks.length > MAX_CHUNKS) {
      return NextResponse.json(
        {
          error: `Te veel chunks (${chunks.length}); max ${MAX_CHUNKS}. Kort het bericht in.`,
        },
        { status: 400 }
      );
    }

    const displayTitle = titleRaw || defaultTitleFromContent(text);
    const filename = `${sanitizeFilename(displayTitle)}.md`;
    const collection = qdrantCollectionForScope(klant);
    const category = "chat";
    const tags = [sourceTag, "chat_export"];

    const ins = db
      .prepare(
        `INSERT INTO knowledge_documents (
          klant, filename, mime, content_sha256, chunk_count, qdrant_collection,
          category, tags_json, warnings_json, strategy, max_chunk_chars, canonical_source
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        klant,
        filename.slice(0, 512),
        "text/markdown",
        content_sha256,
        chunks.length,
        collection,
        category,
        JSON.stringify(tags),
        JSON.stringify(validation.warnings),
        "paragraph",
        maxChunkChars,
        `chat:${sourceTag}`
      );

    docRowId = Number(ins.lastInsertRowid);

    const workspaceId =
      session.workspaceId ?? (await resolveWorkspaceIdBySlug(klant));

    const up = await upsertKnowledgeChunks({
      klant,
      documentId: docRowId,
      chunks,
      workspaceId,
      payloadSource: "chat",
      docKind: "chat",
      basePayload: {
        client: klant,
        category,
        tags,
        source_filename: filename.slice(0, 512),
        canonical_source: `chat:${sourceTag}`,
      },
    });

    if ("error" in up) {
      db.prepare(`DELETE FROM knowledge_documents WHERE id = ?`).run(docRowId);
      return NextResponse.json({ error: up.error }, { status: 502 });
    }

    return NextResponse.json({
      ok: true,
      documentId: docRowId,
      collection: up.collection,
      pointsUpserted: up.upserted,
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
