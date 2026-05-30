export type ChunkStrategy = "paragraph" | "sentence" | "fixed";

export function chunkParagraphs(text: string, maxChars: number): string[] {
  const raw = text.replace(/\r\n/g, "\n").trim();
  if (!raw) return [];
  const paras = raw
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of paras) {
    if (p.length <= maxChars) {
      out.push(p);
      continue;
    }
    for (let i = 0; i < p.length; i += maxChars) {
      out.push(p.slice(i, i + maxChars));
    }
  }
  return out;
}

export function chunkSentences(text: string, maxChars: number): string[] {
  const raw = text.replace(/\r\n/g, "\n").trim();
  if (!raw) return [];
  const parts = raw.split(/(?<=[.!?])\s+/);
  const out: string[] = [];
  let buf = "";
  for (const s of parts) {
    const next = buf ? `${buf} ${s}` : s;
    if (next.length > maxChars && buf) {
      out.push(buf);
      buf = s;
    } else {
      buf = next;
    }
  }
  if (buf) out.push(buf);
  return out;
}

export function chunkFixed(text: string, size: number): string[] {
  const raw = text.replace(/\r\n/g, "\n").trim();
  if (!raw) return [];
  const out: string[] = [];
  for (let i = 0; i < raw.length; i += size) {
    out.push(raw.slice(i, i + size));
  }
  return out;
}

export function chunkKnowledgeText(
  text: string,
  strategy: ChunkStrategy,
  maxChunkChars: number
): string[] {
  if (strategy === "sentence") {
    return chunkSentences(text, maxChunkChars);
  }
  if (strategy === "fixed") {
    return chunkFixed(text, maxChunkChars);
  }
  return chunkParagraphs(text, maxChunkChars);
}

export function clampChunkSize(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
