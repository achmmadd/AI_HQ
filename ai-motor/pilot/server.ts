/**
 * server.ts — Motor shadow-pilot API (trede 1 naar "live").
 *
 * Minimale HTTP-dienst om dezelfde draft-core als de CLI te serveren:
 *
 *   GET  /health  → { ok, model bereikbaar? }
 *   GET  /drafts  → recente concepten uit de append-only store
 *   POST /draft   → body {"review": "...", "context": "..." (optioneel)}
 *                   → dezelfde output als run-shadow.ts (draft + evidence)
 *
 * Netwerkgrens: compose bindt de poort uitsluitend aan het Tailscale-IP van
 * Hetzner (runtime-config, nooit in de repo); er is geen publieke poort.
 * Publiceren blijft handmatig: de gateway-probe in runDraft bewijst per run
 * dat de publish-capability DENY krijgt.
 *
 * Toegang (fail-closed): de aanroeper wordt via de lokale tailscaled (WhoIs)
 * naar een STABIELE node-identiteit (StableID, geen wijzigbare naam) vertaald.
 * PILOT_ACL (runtime-env, JSON) koppelt die identiteit server-side aan de
 * toegestane workspaces: {"<stableId>": ["ws-motor"]}. Een workspace-queryparam
 * wordt nooit vertrouwd — hij wordt alleen tegen de server-side ACL gelegd.
 * Lege/ontbrekende ACL = niemand komt binnen.
 */

import { readFile } from "node:fs/promises";
import { createServer, get as httpGet } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";

import { SYNTHETIC_REVIEW, runDraft } from "./draft-core.ts";
import { listDrafts } from "./draft-store.ts";

const UI_HTML = new URL("./ui.html", import.meta.url);

const TAILSCALE_SOCK =
  process.env.TAILSCALE_SOCK ?? "/run/tailscale/tailscaled.sock";

/** Server-side koppeling identiteit → workspaces. Geen default: fail-closed. */
export type PilotAcl = Readonly<Record<string, readonly string[]>>;

export function parseAcl(raw: string | undefined): PilotAcl {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const acl: Record<string, readonly string[]> = {};
    for (const [id, workspaces] of Object.entries(parsed)) {
      if (Array.isArray(workspaces) && workspaces.every((w) => typeof w === "string")) {
        acl[id] = workspaces;
      }
    }
    return acl;
  } catch {
    // Ongeldige ACL-config → liever niemand binnen dan iemand te veel.
    return {};
  }
}

export interface NodeIdentity {
  /** Stabiele Tailscale node-identiteit (overleeft hernoeming van de node). */
  readonly stableId: string;
  /** Huidige node-naam; alleen voor operator-debugging, nooit voor autorisatie. */
  readonly name: string | null;
}

export type ResolveNode = (ip: string) => Promise<NodeIdentity | null>;

function callerIp(req: IncomingMessage): string {
  return (req.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
}

function whoisNode(ip: string): Promise<NodeIdentity | null> {
  return new Promise((resolve) => {
    const req = httpGet(
      {
        socketPath: TAILSCALE_SOCK,
        path: `/localapi/v0/whois?addr=${encodeURIComponent(ip)}`,
        // tailscaled eist deze Host-header; zonder → 403 "invalid localapi request".
        headers: { Host: "local-tailscaled.sock" },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data) as {
              Node?: { StableID?: string; Name?: string };
            };
            const stableId = parsed.Node?.StableID;
            if (typeof stableId !== "string" || stableId.length === 0) {
              resolve(null);
              return;
            }
            resolve({ stableId, name: parsed.Node?.Name ?? null });
          } catch {
            resolve(null);
          }
        });
      },
    );
    req.on("error", () => resolve(null));
    req.setTimeout(3000, () => {
      req.destroy();
      resolve(null);
    });
  });
}

export interface AccessDeny {
  readonly error: string;
  readonly ip: string;
}

export interface AccessGrant {
  /** De effectieve workspace, altijd uit de server-side ACL — nooit blind uit de queryparam. */
  readonly workspace: string;
}

/**
 * Fail-closed toegangscontrole. Volgorde is bewust: eerst identiteit, dan pas
 * workspace — een onbekende identiteit krijgt nooit te zien welke workspaces
 * bestaan. Zonder workspace-param en precies één toegestane workspace kiest de
 * server die zelf (server-side default); een param wordt alleen tegen de ACL
 * gelegd en nooit vertrouwd.
 */
export async function accessCheck(
  req: IncomingMessage,
  requestedWorkspace: string | null,
  acl: PilotAcl,
  resolveNode: ResolveNode,
): Promise<AccessDeny | AccessGrant> {
  const ip = callerIp(req);
  const node = await resolveNode(ip);
  if (node === null) {
    return { error: "node_not_allowed", ip };
  }
  const allowedWorkspaces = acl[node.stableId];
  if (!allowedWorkspaces || allowedWorkspaces.length === 0) {
    return { error: "node_not_allowed", ip };
  }
  if (requestedWorkspace === null || requestedWorkspace === "") {
    if (allowedWorkspaces.length === 1) {
      return { workspace: allowedWorkspaces[0] };
    }
    return { error: "workspace_required", ip };
  }
  if (!allowedWorkspaces.includes(requestedWorkspace)) {
    return { error: "unknown_workspace", ip };
  }
  return { workspace: requestedWorkspace };
}

function isDeny(
  result: AccessDeny | AccessGrant,
): result is AccessDeny {
  return "error" in result;
}

const PORT = Number(process.env.PILOT_API_PORT ?? "4400");
// De container draait met network_mode: host; bind expliciet op het
// Tailscale-IP (runtime-env) — nooit op 0.0.0.0 (dat zou publiek luisteren).
// Default is localhost: zonder bewuste config is de dienst niet van buitenaf
// bereikbaar.
const HOST = process.env.PILOT_API_HOST ?? "127.0.0.1";
const MODEL_PORT_URL = process.env.MODEL_PORT_URL ?? "http://127.0.0.1:8080";
const MAX_BODY_BYTES = 64 * 1024;

function sendJson(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  // Bewust GEEN CORS-headers: de UI is same-origin (geserveerd door deze
  // server). Zonder Access-Control-Allow-Origin blokkeert iedere browser
  // cross-origin lezen én de preflight voor application/json — een vreemde
  // website kan de pilot niet vanuit een geautoriseerde browser aanroepen.
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("body too large (max 64 KiB)");
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function modelHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${MODEL_PORT_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface PilotServerDeps {
  readonly acl?: PilotAcl;
  readonly resolveNode?: ResolveNode;
  readonly runDraftImpl?: typeof runDraft;
  readonly listDraftsImpl?: typeof listDrafts;
}

export function createPilotServer(deps: PilotServerDeps = {}) {
  const acl = deps.acl ?? parseAcl(process.env.PILOT_ACL);
  const resolveNode = deps.resolveNode ?? whoisNode;
  const runDraftImpl = deps.runDraftImpl ?? runDraft;
  const listDraftsImpl = deps.listDraftsImpl ?? listDrafts;

  return createServer(async (req, res) => {
    try {
      if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
        const html = await readFile(UI_HTML);
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(html);
        return;
      }
      if (req.method === "GET" && req.url === "/health") {
        sendJson(res, 200, { ok: true, model: await modelHealth() });
        return;
      }
      if (req.method === "GET" && req.url?.startsWith("/drafts")) {
        const params = new URL(req.url, "http://localhost").searchParams;
        // De queryparam wordt nooit vertrouwd: accessCheck legt hem tegen de
        // server-side ACL van deze specifieke identiteit.
        const access = await accessCheck(
          req,
          params.get("workspace"),
          acl,
          resolveNode,
        );
        if (isDeny(access)) {
          sendJson(res, 403, { ok: false, ...access });
          return;
        }
        const limit = Math.min(
          Math.max(Number(params.get("limit") ?? "20") || 20, 1),
          100,
        );
        sendJson(res, 200, {
          ok: true,
          workspace: access.workspace,
          drafts: await listDraftsImpl(limit),
        });
        return;
      }
      if (req.method === "POST" && req.url === "/draft") {
        const params = new URL(req.url, "http://localhost").searchParams;
        const access = await accessCheck(
          req,
          params.get("workspace"),
          acl,
          resolveNode,
        );
        if (isDeny(access)) {
          sendJson(res, 403, { ok: false, ...access });
          return;
        }
        // Alleen application/json: een "simple request" (text/plain) zou
        // zonder preflight door een vreemde site verstuurd kunnen worden.
        const contentType = req.headers["content-type"] ?? "";
        if (!contentType.startsWith("application/json")) {
          sendJson(res, 415, { ok: false, error: "content_type_must_be_json" });
          return;
        }
        const raw = await readBody(req);
        let body: { review?: unknown; context?: unknown };
        try {
          body = JSON.parse(raw) as typeof body;
        } catch {
          sendJson(res, 400, { ok: false, error: "body must be JSON" });
          return;
        }
        // Context komt NOOIT uit het request: alleen CONTEXT_MODE (demo of
        // privé-volume) bepaalt de bedrijfscontext. Een meegestuurde
        // context-sleutel wordt expliciet geweigerd, niet genegeerd.
        if (body !== null && typeof body === "object" && "context" in body) {
          sendJson(res, 400, {
            ok: false,
            error: "context_via_request_not_allowed",
          });
          return;
        }
        const review =
          typeof body.review === "string" ? body.review.trim() : "";
        if (!review) {
          sendJson(res, 400, {
            ok: false,
            error: 'veld "review" (string) is verplicht',
          });
          return;
        }
        const output = await runDraftImpl({
          reviewText: review,
          isSynthetic: review === SYNTHETIC_REVIEW,
        });
        sendJson(res, output.ok ? 200 : 502, output);
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
  const server = createPilotServer();
  server.listen(PORT, HOST, () => {
    process.stdout.write(`motor-pilot API luistert op ${HOST}:${PORT}\n`);
  });
}
