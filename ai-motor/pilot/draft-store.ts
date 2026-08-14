/**
 * draft-store.ts — eerste echte tool-adapter achter de ADR-110 gateway.
 *
 * Append-only JSONL-opslag voor concepten. De adapter voert alleen uit als
 * de gateway een settlement heeft teruggegeven (executeAction → executed:
 * true); zonder geldige receipt wordt nooit geschreven. Zo is iedere regel
 * in de store causaal terug te leiden naar een gateway-besluit.
 *
 * Pad: DRAFT_STORE_PATH (default /data/drafts.jsonl — in compose een named
 * volume, want de container is verder read-only).
 */

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";

export const DRAFT_STORE_PATH =
  process.env.DRAFT_STORE_PATH ?? "/data/drafts.jsonl";

export interface DraftStoreRecord {
  readonly stored_at: string;
  readonly run_id: string;
  readonly receipt_id: string;
  readonly synthetic: boolean;
  readonly review: string;
  readonly draft: string;
}

export interface AppendResult {
  readonly ok: boolean;
  readonly path: string;
  readonly bytes?: number;
  readonly error?: string;
}

export async function appendDraft(
  record: DraftStoreRecord,
  path: string = DRAFT_STORE_PATH,
): Promise<AppendResult> {
  try {
    await mkdir(dirname(path), { recursive: true });
    const line = `${JSON.stringify(record)}\n`;
    await appendFile(path, line, "utf8");
    return { ok: true, path, bytes: Buffer.byteLength(line, "utf8") };
  } catch (error) {
    return {
      ok: false,
      path,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function listDrafts(
  limit = 20,
  path: string = DRAFT_STORE_PATH,
): Promise<readonly DraftStoreRecord[]> {
  try {
    const raw = await readFile(path, "utf8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    return lines
      .slice(-limit)
      .map((l) => JSON.parse(l) as DraftStoreRecord)
      .reverse();
  } catch {
    return [];
  }
}
