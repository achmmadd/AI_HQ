/**
 * store-service.ts — de draft.store/draft.decision action-driver binnen de
 * trust boundary.
 *
 * Enige proces in de pilot dat /data schrijft (append-only JSONL). Draait in
 * een eigen container ZONDER host-poort: alleen bereikbaar op het interne
 * pilot-net. De API mount /data read-only en kan dus fysiek niet schrijven.
 *
 * Elke schrijfopdracht vereist een geldig v2-settlement (zie settlement.ts):
 * HMAC over álle causale velden, payload-gebonden, ≤ 60 s oud, met nonce.
 *
 * Eenmaligheid is ATOMISCH en AT-MOST-ONCE (spoor A, integratiesprint):
 * vóór iedere append wordt de claim met een exclusieve create (O_EXCL)
 * gereserveerd in een claims-directory op hetzelfde volume. Twee
 * gelijktijdige identieke settlements → precies één write. Een crash na de
 * claim maar vóór de append verliest hoogstens die ene write — nooit een
 * dubbele. Een gebrande-maar-niet-geschreven claim vereist een nieuwe run
 * (nieuwe nonce); dat is de bewuste fail-closed keuze.
 * Beslissingen krijgen bovendien een atomische per-concept-claim
 * (één beslissing per draft_run_id per workspace, first-decision-wins).
 *
 * Tenancy (P0.8): ieder record draagt verplicht een workspace_id. Records
 * zonder (of met een lege/niet-string) workspace worden geweigerd (400,
 * fail-closed) en de tenancy van het record moet exact overeenkomen met de
 * geauthenticeerde workspace in het settlement (anders 403). De read-side
 * filtert per workspace (zie draft-store.ts); legacy-regels zonder het veld
 * zijn daarmee overal onzichtbaar.
 */

import { appendFile, mkdir, open } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { isValidStoreSecret, verifySettlement } from "./settlement.ts";
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
  readonly claimDir?: string;
  /** Test-only: injecteerbaar faalpunt tussen claim en append (crashproef). */
  readonly beforeAppend?: () => Promise<void>;
}

/** Atomische claim via exclusieve create; false als de claim al bestond. */
async function claim(dir: string, key: string): Promise<boolean> {
  try {
    const handle = await open(join(dir, key), "wx");
    await handle.close();
    return true;
  } catch {
    return false;
  }
}

export function createStoreServer(
  storePath: string = STORE_PATH,
  options: StoreServerOptions = {},
) {
  // Fail-closed: zonder geldig gedeeld secret (32 bytes, hex) kan geen enkel
  // bewijs geverifieerd worden en schrijft de store principieel niets.
  const secret = options.secret ?? process.env.PILOT_STORE_SECRET ?? "";
  const secretOk = isValidStoreSecret(secret);
  const claimDir = options.claimDir ?? join(dirname(storePath), "claims");

  return createServer(async (req, res) => {
    try {
      if (req.method === "GET" && req.url === "/health") {
        sendJson(res, 200, { ok: true });
        return;
      }
      if (req.method === "POST" && req.url === "/store") {
        if (!secretOk) {
          sendJson(res, 503, { ok: false, error: "store_not_configured" });
          return;
        }
        const body = JSON.parse(await readBody(req)) as {
          record?: {
            type?: unknown;
            workspace_id?: unknown;
            run_id?: unknown;
            draft?: unknown;
            draft_run_id?: unknown;
            decision?: unknown;
          };
          settlement?: Partial<SignedSettlement>;
        };
        const s = body.settlement;
        if (
          !s ||
          typeof s.v !== "string" ||
          typeof s.receipt_id !== "string" ||
          typeof s.nonce !== "string" ||
          typeof s.capability !== "string" ||
          typeof s.tool !== "string" ||
          typeof s.action_id !== "string" ||
          typeof s.workspace_id !== "string" ||
          typeof s.task_id !== "string" ||
          typeof s.run_id !== "string" ||
          typeof s.attempt_id !== "string" ||
          typeof s.policy_id !== "string" ||
          typeof s.policy_version !== "string" ||
          typeof s.policy_digest !== "string" ||
          typeof s.argument_hash !== "string" ||
          typeof s.issued_at !== "string" ||
          typeof s.executed_at !== "string" ||
          typeof s.expires_at !== "string" ||
          typeof s.record_sha256 !== "string" ||
          typeof s.signature !== "string"
        ) {
          sendJson(res, 403, { ok: false, error: "settlement_required" });
          return;
        }
        const r = body.record;
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
        } else {
          sendJson(res, 400, { ok: false, error: "invalid_record_type" });
          return;
        }
        // Verplichte tenancy (P0.8): zonder aantoonbare workspace is er niets
        // te routeren. Dit is een vormeis aan het record (400), los van het
        // bewijs — óók voor de legacy-route (records zonder type = "draft").
        const recordWorkspace = (r as { workspace_id?: unknown } | undefined)
          ?.workspace_id;
        if (typeof recordWorkspace !== "string" || recordWorkspace.trim() === "") {
          sendJson(res, 400, { ok: false, error: "workspace_id_required" });
          return;
        }
        // Authentiek bewijs: v2, geldige HMAC, payload-gebonden, niet verlopen.
        const verification = verifySettlement(
          secret,
          s as SignedSettlement,
          body.record,
        );
        if (!verification.ok) {
          sendJson(res, 403, { ok: false, error: verification.reason });
          return;
        }
        // Pas ná verificatie is de settlement-tenancy authentiek: de tenancy
        // van het record moet er exact mee overeenkomen. Een afwijking is een
        // bewijsschending (403), geen vormfout.
        if (recordWorkspace !== s.workspace_id) {
          sendJson(res, 403, { ok: false, error: "workspace_mismatch" });
          return;
        }
        // Atomaire claims VÓÓR de write (at-most-once, fail-closed):
        // 1. de handtekening zelf (replay), 2. bij beslissingen het concept
        // binnen de eigen workspace (tenancy-scope, P0.8).
        await mkdir(claimDir, { recursive: true });
        if (!(await claim(claimDir, `sig-${s.signature}`))) {
          sendJson(res, 403, { ok: false, error: "settlement_replayed" });
          return;
        }
        if (kind === "decision") {
          const draftKey = (r as { draft_run_id: string }).draft_run_id;
          if (!(await claim(claimDir, `decision-${s.workspace_id}-${draftKey}`))) {
            sendJson(res, 409, { ok: false, error: "already_decided" });
            return;
          }
        }
        if (options.beforeAppend) await options.beforeAppend();
        await mkdir(dirname(targetPath), { recursive: true });
        const line = `${JSON.stringify(body.record)}\n`;
        await appendFile(targetPath, line, "utf8");
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
