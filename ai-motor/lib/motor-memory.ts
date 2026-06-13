import { getChatTranscriptForMemory } from "@/lib/chat-memory-transcript";
import { getCodeSessionTranscriptForMemory } from "@/lib/code-memory-transcript";
import {
  embedForQdrant,
  payloadText,
  type QdrantHit,
} from "@/lib/knowledge-service";
import { anthropicComplete, getAnthropicApiKey } from "@/lib/anthropic-messages";

export const MOTOR_MEMORY_SOURCE_CHAT = "chat";
export const MOTOR_MEMORY_SOURCE_CODE_AGENT = "code_agent";

const QDRANT_URL = (process.env.QDRANT_URL || "http://127.0.0.1:6333").replace(
  /\/$/,
  ""
);

export const MOTOR_MEMORY_COLLECTION =
  process.env.QDRANT_MEMORY_COLLECTION?.trim() || "motor_memory";

let ensureCollectionPromise: Promise<void> | null = null;

async function ensureMotorMemoryCollection(): Promise<void> {
  const info = await fetch(
    `${QDRANT_URL}/collections/${MOTOR_MEMORY_COLLECTION}`,
    { signal: AbortSignal.timeout(15_000) }
  );
  if (info.ok) return;

  const vector = await embedForQdrant("init");
  const size = vector.length;
  if (!size) throw new Error("motor_memory: embedding dimension 0");

  const put = await fetch(`${QDRANT_URL}/collections/${MOTOR_MEMORY_COLLECTION}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vectors: { size, distance: "Cosine" },
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!put.ok) {
    const t = await put.text();
    throw new Error(`motor_memory create: ${t || put.status}`);
  }
}

function ensureCollectionOnce(): Promise<void> {
  if (!ensureCollectionPromise) {
    ensureCollectionPromise = ensureMotorMemoryCollection().catch((e) => {
      ensureCollectionPromise = null;
      throw e;
    });
  }
  return ensureCollectionPromise;
}

function memorySearchFilter(
  klant: string,
  source?: string
): Record<string, unknown> | undefined {
  const must: Record<string, unknown>[] = [];
  const k = (klant || "").trim();
  if (k) must.push({ key: "client", match: { value: k } });
  const src = (source || "").trim();
  if (src) must.push({ key: "source", match: { value: src } });
  if (!must.length) return undefined;
  return { must };
}

export type MotorMemoryIndexHit = {
  id: string;
  score: number;
  onderwerpen?: string;
  conversationId?: number;
  codeSessionId?: number;
  datum?: string;
  source?: string;
};

export async function searchMotorMemoryIndex(
  query: string,
  klant: string,
  opts?: { limit?: number; source?: string }
): Promise<{ hits: MotorMemoryIndexHit[]; error?: string }> {
  const q = query.trim();
  if (!q) return { hits: [] };

  try {
    await ensureCollectionOnce();
    const vector = await embedForQdrant(q);
    if (!vector.length) return { hits: [], error: "embedding failed" };

    const cap = Math.min(Math.max(opts?.limit ?? 8, 1), 20);
    const body: Record<string, unknown> = {
      vector,
      limit: cap,
      with_payload: [
        "onderwerpen",
        "conversation_id",
        "code_session_id",
        "source",
        "datum",
      ],
    };

    const filter = memorySearchFilter(klant, opts?.source);
    if (filter) body.filter = filter;

    const res = await fetch(
      `${QDRANT_URL}/collections/${MOTOR_MEMORY_COLLECTION}/points/search`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      }
    );

    const text = await res.text();
    if (!res.ok) {
      return { hits: [], error: text || `Qdrant ${res.status}` };
    }

    const data = JSON.parse(text) as { result?: QdrantHit[] };
    const results = Array.isArray(data.result) ? data.result : [];
    const hits: MotorMemoryIndexHit[] = [];
    for (const h of results) {
      const p = h.payload || {};
      const id = h.id != null ? String(h.id) : "";
      if (!id) continue;
      hits.push({
        id,
        score: typeof h.score === "number" ? h.score : 0,
        onderwerpen:
          typeof p.onderwerpen === "string" ? p.onderwerpen : undefined,
        conversationId:
          typeof p.conversation_id === "number"
            ? p.conversation_id
            : undefined,
        codeSessionId:
          typeof p.code_session_id === "number"
            ? p.code_session_id
            : undefined,
        datum: typeof p.datum === "string" ? p.datum : undefined,
        source: typeof p.source === "string" ? p.source : undefined,
      });
    }
    return { hits };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { hits: [], error: msg };
  }
}

export async function fetchMotorMemoryChunks(
  ids: string[]
): Promise<{ id: string; text: string }[]> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (!unique.length) return [];

  try {
    await ensureCollectionOnce();
    const res = await fetch(
      `${QDRANT_URL}/collections/${MOTOR_MEMORY_COLLECTION}/points`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: unique,
          with_payload: true,
          with_vector: false,
        }),
        signal: AbortSignal.timeout(30_000),
      }
    );
    const text = await res.text();
    if (!res.ok) return [];

    const data = JSON.parse(text) as {
      result?: Array<{ id?: unknown; payload?: Record<string, unknown> }>;
    };
    const rows = Array.isArray(data.result) ? data.result : [];
    return rows
      .map((row) => {
        const id = row.id != null ? String(row.id) : "";
        const body =
          typeof row.payload?.text === "string" ? row.payload.text.trim() : "";
        return id && body ? { id, text: body } : null;
      })
      .filter((x): x is { id: string; text: string } => x != null);
  } catch {
    return [];
  }
}

export async function searchMotorMemories(
  query: string,
  klant: string,
  limit = 5
): Promise<{ results: QdrantHit[]; error?: string }> {
  const q = query.trim();
  if (!q) return { results: [] };

  try {
    await ensureCollectionOnce();
    const vector = await embedForQdrant(q);
    if (!vector.length) return { results: [], error: "embedding failed" };

    const cap = Math.min(Math.max(limit, 1), 20);
    const body: Record<string, unknown> = {
      vector,
      limit: cap,
      with_payload: true,
    };

    const filter = memorySearchFilter(klant);
    if (filter) body.filter = filter;

    const res = await fetch(
      `${QDRANT_URL}/collections/${MOTOR_MEMORY_COLLECTION}/points/search`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      }
    );

    const text = await res.text();
    if (!res.ok) {
      return { results: [], error: text || `Qdrant ${res.status}` };
    }

    const data = JSON.parse(text) as { result?: QdrantHit[] };
    const results = Array.isArray(data.result) ? data.result : [];
    return { results };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { results: [], error: msg };
  }
}

function parseSummaryJson(raw: string): { summary: string; topics: string } | null {
  const t = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    const o = JSON.parse(t) as { summary?: unknown; onderwerpen?: unknown };
    const summary = typeof o.summary === "string" ? o.summary.trim() : "";
    const topics =
      typeof o.onderwerpen === "string"
        ? o.onderwerpen.trim()
        : Array.isArray(o.onderwerpen)
          ? o.onderwerpen.filter((x) => typeof x === "string").join(", ")
          : "";
    if (!summary) return null;
    return { summary, topics: topics || "algemeen" };
  } catch {
    return null;
  }
}

export async function summarizeConversationForMotorMemory(
  transcript: { role: string; content: string }[],
  klant: string
): Promise<{ summary: string; topics: string } | null> {
  if (!getAnthropicApiKey() || transcript.length === 0) return null;

  const body = transcript
    .map((t) => `${t.role}: ${t.content}`)
    .join("\n")
    .slice(0, 48_000);

  const { text } = await anthropicComplete({
    system: `Je vat gesprekken samen voor langetermijngeheugen. Klant: ${klant}.
Antwoord uitsluitend met geldige JSON (geen markdown), formaat:
{"summary":"korte samenvatting in informeel Nederlands, max 6 zinnen","onderwerpen":"trefwoord1, trefwoord2, trefwoord3"}`,
    messages: [{ role: "user", content: `Gesprek:\n\n${body}` }],
    maxTokens: 900,
  });

  return parseSummaryJson(text);
}

export async function upsertMotorMemoryPoint(opts: {
  klant: string;
  conversationId?: number;
  codeSessionId?: number;
  source?: string;
  summary: string;
  topics: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    await ensureCollectionOnce();
    const vector = await embedForQdrant(opts.summary);
    if (!vector.length) return { ok: false, error: "embedding failed" };

    const id = crypto.randomUUID();
    const datum = new Date().toISOString().slice(0, 10);

    const res = await fetch(
      `${QDRANT_URL}/collections/${MOTOR_MEMORY_COLLECTION}/points`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          points: [
            {
              id,
              vector,
              payload: {
                text: opts.summary,
                client: opts.klant,
                datum,
                onderwerpen: opts.topics,
                source: opts.source?.trim() || MOTOR_MEMORY_SOURCE_CHAT,
                ...(opts.conversationId != null
                  ? { conversation_id: opts.conversationId }
                  : {}),
                ...(opts.codeSessionId != null
                  ? { code_session_id: opts.codeSessionId }
                  : {}),
              },
            },
          ],
        }),
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (!res.ok) {
      const t = await res.text();
      return { ok: false, error: t || String(res.status) };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export function formatMotorMemoryContext(hits: QdrantHit[], maxChars = 2400): string {
  if (!hits.length) return "";
  const lines: string[] = [];
  let used = 0;
  for (const h of hits) {
    const t = payloadText(h).trim();
    if (!t) continue;
    const score =
      typeof h.score === "number" ? ` [${h.score.toFixed(3)}]` : "";
    const line = `- ${t}${score}`;
    if (used + line.length + 1 > maxChars) break;
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join("\n");
}

function formatTimelineExcerpt(
  transcript: { role: string; content: string }[],
  maxChars = 1800
): string {
  const lines: string[] = [];
  let used = 0;
  for (const t of transcript) {
    const line = `${t.role}: ${t.content.trim().slice(0, 400)}`;
    if (used + line.length + 1 > maxChars) break;
    lines.push(line);
    used += line.length + 1;
  }
  return lines.join("\n");
}

/** 3-layer retrieval: index → session timeline → full chunks (claude-mem pattern). */
export async function buildProgressiveCodeMemoryContext(opts: {
  query: string;
  klant: string;
  sessionId?: number | null;
  project?: string;
}): Promise<string> {
  const q = opts.query.trim();
  if (!q) return "";

  const index = await searchMotorMemoryIndex(q, opts.klant, {
    limit: 8,
    source: MOTOR_MEMORY_SOURCE_CODE_AGENT,
  });

  const sections: string[] = [];

  if (index.hits.length) {
    const indexLines = index.hits
      .slice(0, 6)
      .map(
        (h, i) =>
          `${i + 1}. [${h.score.toFixed(3)}] ${h.onderwerpen || "code"} (${h.datum || "?"})`
      )
      .join("\n");
    sections.push(`### Geheugen-index (Qdrant ${MOTOR_MEMORY_COLLECTION})\n${indexLines}`);
  }

  if (opts.sessionId) {
    const timeline = getCodeSessionTranscriptForMemory(opts.sessionId, 16);
    if (timeline.length) {
      sections.push(
        `### Sessie-timeline (code_session ${opts.sessionId})\n${formatTimelineExcerpt(timeline)}`
      );
    }
  }

  const topIds = index.hits.slice(0, 3).map((h) => h.id);
  if (topIds.length) {
    const chunks = await fetchMotorMemoryChunks(topIds);
    if (chunks.length) {
      const chunkBlock = chunks
        .map((c, i) => `${i + 1}. ${c.text.slice(0, 700)}`)
        .join("\n");
      sections.push(`### Relevante samenvattingen\n${chunkBlock}`);
    }
  }

  if (!sections.length) return "";
  const project = opts.project?.trim();
  const header = project
    ? `## Code-geheugen (${opts.klant}/${project})`
    : `## Code-geheugen (${opts.klant})`;
  return `${header}\n${sections.join("\n\n")}`;
}

/** 3-layer retrieval for main chat: index → Postgres timeline → full chunks. */
export async function buildProgressiveChatMemoryContext(opts: {
  query: string;
  klant: string;
  conversationId?: number | null;
}): Promise<string> {
  const q = opts.query.trim();
  if (!q) return "";

  const index = await searchMotorMemoryIndex(q, opts.klant, {
    limit: 8,
    source: MOTOR_MEMORY_SOURCE_CHAT,
  });

  const sections: string[] = [];

  if (index.hits.length) {
    const indexLines = index.hits
      .slice(0, 6)
      .map(
        (h, i) =>
          `${i + 1}. [${h.score.toFixed(3)}] ${h.onderwerpen || "chat"} (${h.datum || "?"})`
      )
      .join("\n");
    sections.push(
      `### Geheugen-index (Qdrant ${MOTOR_MEMORY_COLLECTION})\n${indexLines}`
    );
  }

  if (opts.conversationId) {
    const timeline = getChatTranscriptForMemory(opts.conversationId, 16);
    if (timeline.length) {
      sections.push(
        `### Sessie-timeline (conversation ${opts.conversationId})\n${formatTimelineExcerpt(timeline)}`
      );
    }
  }

  const topIds = index.hits.slice(0, 3).map((h) => h.id);
  if (topIds.length) {
    const chunks = await fetchMotorMemoryChunks(topIds);
    if (chunks.length) {
      const chunkBlock = chunks
        .map((c, i) => `${i + 1}. ${c.text.slice(0, 700)}`)
        .join("\n");
      sections.push(`### Relevante samenvattingen\n${chunkBlock}`);
    }
  }

  if (!sections.length) return "";
  return `## Chat-geheugen (${opts.klant})\n${sections.join("\n\n")}`;
}

export async function ingestConversationToMotorMemory(
  transcript: { role: string; content: string }[],
  klant: string,
  conversationId: number
): Promise<void> {
  try {
    const parsed = await summarizeConversationForMotorMemory(transcript, klant);
    if (!parsed) return;
    const up = await upsertMotorMemoryPoint({
      klant,
      conversationId,
      source: MOTOR_MEMORY_SOURCE_CHAT,
      summary: parsed.summary,
      topics: parsed.topics,
    });
    if (!up.ok && up.error) {
      console.warn("[motor-memory] upsert skipped:", up.error);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[motor-memory] ingest failed:", msg);
  }
}

const CODE_MEMORY_INGEST_MIN_MESSAGES = 4;

export function maybeIngestCodeSessionMemory(
  sessionId: number | null | undefined,
  klant: string
): void {
  if (!sessionId) return;
  const transcript = getCodeSessionTranscriptForMemory(sessionId, 32);
  if (transcript.length < CODE_MEMORY_INGEST_MIN_MESSAGES) return;

  const assistantTurns = transcript.filter((t) => t.role === "assistant").length;
  if (assistantTurns < 2 || assistantTurns % 3 !== 0) return;

  void ingestCodeSessionToMotorMemory(transcript, klant, sessionId);
}

export async function ingestCodeSessionToMotorMemory(
  transcript: { role: string; content: string }[],
  klant: string,
  codeSessionId: number
): Promise<void> {
  try {
    const parsed = await summarizeConversationForMotorMemory(transcript, klant);
    if (!parsed) return;
    const up = await upsertMotorMemoryPoint({
      klant,
      codeSessionId,
      source: MOTOR_MEMORY_SOURCE_CODE_AGENT,
      summary: parsed.summary,
      topics: parsed.topics,
    });
    if (!up.ok && up.error) {
      console.warn("[motor-memory] code ingest skipped:", up.error);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[motor-memory] code ingest failed:", msg);
  }
}
