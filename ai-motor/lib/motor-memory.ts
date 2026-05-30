import {
  embedForQdrant,
  payloadText,
  type QdrantHit,
} from "@/lib/knowledge-service";
import { anthropicComplete, getAnthropicApiKey } from "@/lib/anthropic-messages";

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

    const k = (klant || "").trim();
    if (k) {
      body.filter = {
        must: [{ key: "client", match: { value: k } }],
      };
    }

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
  conversationId: number;
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
                conversation_id: opts.conversationId,
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
