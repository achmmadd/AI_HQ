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

import { appendFile, mkdir, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { verifySettlement } from "./settlement.ts";
import type { SignedSettlement } from "./settlement.ts";

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

export interface StoreServerOptions {
  readonly secret?: string;
  readonly usedPath?: string;
}

export function createStoreServer(
  storePath: string = STORE_PATH,
  options: StoreServerOptions = {},
) {
  // Fail-closed: zonder gedeeld secret kan geen enkel bewijs geverifieerd
  // worden en schrijft de store principieel niets.
  const secret = options.secret ?? process.env.PILOT_STORE_SECRET ?? "";
  const usedPath =
    options.usedPath ?? join(dirname(storePath), "used-settlements.jsonl");

  // Replay-registratie gebeurt op de HANDTEKENING, niet op receipt_id: de
  // gateway nummert receipts per verse instantie (rcpt-1, rcpt-2, …), dus
  // receipt_id's zijn niet uniek over runs heen. De HMAC over het volledige
  // payload-gebonden bewijs is dat wél; een exacte replay heeft dezelfde
  // handtekening en wordt geweigerd.
  async function hasUsedSignature(signature: string): Promise<boolean> {
    try {
      const raw = await readFile(usedPath, "utf8");
      return raw.split("\n").includes(signature);
    } catch {
      return false;
    }
  }

  return createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/health") {
        sendJson(res, 200, { ok: true });
        return;
      }
      if (req.method === "POST" && req.url === "/store") {
        if (!secret) {
          sendJson(res, 503, { ok: false, error: "store_not_configured" });
          return;
        }
        const body = JSON.parse(await readBody(req)) as {
          record?: { run_id?: unknown; draft?: unknown; review?: unknown };
          settlement?: Partial<SignedSettlement>;
        };
        const s = body.settlement;
        if (
          !s ||
          typeof s.receipt_id !== "string" ||
          typeof s.action_id !== "string" ||
          typeof s.argument_hash !== "string" ||
          typeof s.executed_at !== "string" ||
          typeof s.expires_at !== "string" ||
          typeof s.record_sha256 !== "string" ||
          typeof s.signature !== "string"
        ) {
          sendJson(res, 403, { ok: false, error: "settlement_required" });
          return;
        }
        const r = body.record as
          | {
              type?: unknown;
              run_id?: unknown;
              draft?: unknown;
              draft_run_id?: unknown;
              decision?: unknown;
              records?: unknown;
            }
          | undefined;
        // Routering op record.type met een vaste bestandsmap — de client
        // kiest nooit zelf een pad. Oude records zonder type = "draft".
        const kind = r?.type === undefined ? "draft" : r.type;
        let targetPath: string;
        if (kind === "draft") {
          if (!r || typeof r.run_id !== "string" || typeof r.draft !== "string") {
            sendJson(res, 400, { ok: false, error: "invalid record" });
            return;
          }
          targetPath = storePath;
        } else if (kind === "decision") {
          if (
            !r ||
            typeof r.draft_run_id !== "string" ||
            (r.decision !== "approved" && r.decision !== "rejected")
          ) {
            sendJson(res, 400, { ok: false, error: "invalid record" });
            return;
          }
          targetPath = join(dirname(storePath), "decisions.jsonl");
        } else if (kind === "evidence") {
          if (!r || typeof r.run_id !== "string" || !Array.isArray(r.records)) {
            sendJson(res, 400, { ok: false, error: "invalid record" });
            return;
          }
          targetPath = join(dirname(storePath), "evidence.jsonl");
        } else {
          sendJson(res, 400, { ok: false, error: "invalid_record_type" });
          return;
        }
        // Authentiek bewijs: geldige HMAC, payload-gebonden, niet verlopen.
        const verification = verifySettlement(
          secret,
          s as SignedSettlement,
          body.record,
        );
        if (!verification.ok) {
          sendJson(res, 403, { ok: false, error: verification.reason });
          return;
        }
        // Eenmalig: dezelfde ondertekening mag nooit twee keer schrijven.
        if (await hasUsedSignature(s.signature)) {
          sendJson(res, 403, { ok: false, error: "settlement_replayed" });
          return;
        }
        await mkdir(dirname(targetPath), { recursive: true });
        const line = `${JSON.stringify(body.record)}\n`;
        await appendFile(targetPath, line, "utf8");
        await appendFile(usedPath, `${s.signature}\n`, "utf8");
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
}

const isMain =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const server = createStoreServer();
  // Bind uitsluitend op localhost: de container draait met network_mode: host,
  // dus is de store alleen voor host-lokale processen (de API) bereikbaar —
  // niet via het tailnet en zeker niet publiek.
  server.listen(PORT, "127.0.0.1", () => {
    process.stdout.write(
      `motor-pilot store-service luistert op 127.0.0.1:${PORT} (schrijft ${STORE_PATH})\n`,
    );
  });
}
