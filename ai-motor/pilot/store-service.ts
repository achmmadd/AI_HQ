/**
 * store-service.ts — de draft.store action-driver binnen de trust boundary.
 *
 * Enige proces in de pilot dat /data schrijft (append-only JSONL). Draait in
 * een eigen container ZONDER host-poort: alleen bereikbaar op het interne
 * pilot-net. De API mount /data read-only en kan dus fysiek niet schrijven.
 *
 * Elke schrijfopdracht vereist een gateway-settlement (receipt_id,
 * action_id, argument_hash, executed_at) — zonder settlement wordt er
 * principieel niet geschreven, ook al is de aanroeper intern.
 */

import { appendFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname } from "node:path";

const PORT = Number(process.env.STORE_PORT ?? "4401");
const STORE_PATH = process.env.DRAFT_STORE_PATH ?? "/data/drafts.jsonl";
const MAX_BODY_BYTES = 64 * 1024;

function sendJson(
  res: import("node:http").ServerResponse,
  status: number,
  body: unknown,
) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(
  req: import("node:http").IncomingMessage,
): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }
    if (req.method === "POST" && req.url === "/store") {
      const body = JSON.parse(await readBody(req)) as {
        record?: { run_id?: unknown; draft?: unknown; review?: unknown };
        settlement?: {
          receipt_id?: unknown;
          action_id?: unknown;
          argument_hash?: unknown;
          executed_at?: unknown;
        };
      };
      const s = body.settlement;
      if (
        !s ||
        typeof s.receipt_id !== "string" ||
        typeof s.action_id !== "string" ||
        typeof s.argument_hash !== "string" ||
        typeof s.executed_at !== "string"
      ) {
        sendJson(res, 403, { ok: false, error: "settlement_required" });
        return;
      }
      const r = body.record;
      if (!r || typeof r.run_id !== "string" || typeof r.draft !== "string") {
        sendJson(res, 400, { ok: false, error: "invalid record" });
        return;
      }
      await mkdir(dirname(STORE_PATH), { recursive: true });
      const line = `${JSON.stringify(body.record)}\n`;
      await appendFile(STORE_PATH, line, "utf8");
      sendJson(res, 200, { ok: true, bytes: Buffer.byteLength(line, "utf8") });
      return;
    }
    sendJson(res, 404, { ok: false, error: "not found" });
  } catch (error) {
    sendJson(res, 500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

// Bind uitsluitend op localhost: de container draait met network_mode: host,
// dus is de store alleen voor host-lokale processen (de API) bereikbaar —
// niet via het tailnet en zeker niet publiek.
server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(
    `motor-pilot store-service luistert op 127.0.0.1:${PORT} (schrijft ${STORE_PATH})\n`,
  );
});
