/**
 * P2.0 /motor service — isolated from the P0 API on :4400.
 *
 * Serves only /motor and /api/motor/*. Binds loopback or one tailnet address.
 * WhoIs + PILOT_P2_ACL (human UI) and PILOT_P2_ORCHESTRATOR_ACL (NUC).
 * P0 PILOT_ACL on :4400 is never read or written by this process.
 * No store, ModelPort, drafts-volume, context-volume or external effectors.
 */

import { createServer, get as httpGet } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";

import {
  accessCheck,
  parseAcl,
  type NodeIdentity,
  type PilotAcl,
  type ResolveNode,
} from "./server.ts";
import {
  FORBIDDEN_VIEW_MARKERS,
  HOME_TENANT_ID,
  OTHER_TENANT_ID,
  serializeFoundationView,
} from "./p1-foundation.ts";
import {
  EMPTY_OVERLAY,
  prepareTypedDraft,
  resolveMotorShell,
  tryPublish,
  type ShellOverlay,
} from "./p1-shell.ts";
import { EMPTY_ROSTER_SESSION, type RosterSession } from "./p1-roster.ts";
import {
  appendReviewPatch,
  decideReview,
  mergeReviewSession,
  submitDraftForReview,
  type ReviewPatch,
} from "./p1-review.ts";
import { collectWorkspaceEvidence, evidenceRailLeaksContent, openEvidenceRail } from "./p1-evidence.ts";
import { resolveP2Bind } from "./p2-bind.ts";
import { renderMotorHtml } from "./p2-motor-ui.ts";
import {
  orchestratorAllowed,
  orchestratorBody,
  orchestratorBodyLeaks,
  parseOrchestratorAcl,
  whoisStableId,
  P2_ORCHESTRATOR_HEALTH_PATH,
  P2_ORCHESTRATOR_READY_PATH,
} from "./p2-orchestrator.ts";

const TAILSCALE_SOCK = process.env.TAILSCALE_SOCK ?? "/run/tailscale/tailscaled.sock";
const MAX_BODY_BYTES = 64 * 1024;

export type P2SessionState = {
  roster: RosterSession;
  patches: readonly ReviewPatch[];
};

function callerIp(req: IncomingMessage): string {
  return (req.socket.remoteAddress ?? "").replace(/^::ffff:/, "");
}

function whoisNode(ip: string): Promise<NodeIdentity | null> {
  return new Promise((resolve) => {
    const req = httpGet(
      {
        socketPath: TAILSCALE_SOCK,
        path: `/localapi/v0/whois?addr=${encodeURIComponent(ip)}`,
        headers: { Host: "local-tailscaled.sock" },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data) as {
              Node?: { StableID?: string; ID?: string; Name?: string };
            };
            const stableId = whoisStableId(parsed.Node);
            if (!stableId) {
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

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8" });
  res.end(html);
}

function healthBody(): { ok: true } {
  return { ok: true };
}

function healthLeaks(body: unknown): boolean {
  const blob = JSON.stringify(body);
  return (
    blob.includes("context") ||
    blob.includes("draft") ||
    blob.includes("secret") ||
    blob.includes("acl") ||
    blob.includes("review") ||
    blob.includes(FORBIDDEN_VIEW_MARKERS.secret) ||
    blob.includes(FORBIDDEN_VIEW_MARKERS.contextBody)
  );
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new Error("body too large");
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return {};
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("json_object_required");
  }
  return parsed as Record<string, unknown>;
}

function pathOf(req: IncomingMessage): { pathname: string; searchParams: URLSearchParams } {
  const url = new URL(req.url ?? "/", "http://localhost");
  return { pathname: url.pathname.replace(/\/+$/, "") || "/", searchParams: url.searchParams };
}

function emptySession(): P2SessionState {
  return {
    roster: {
      ...EMPTY_ROSTER_SESSION,
      overlay: { ...EMPTY_OVERLAY, drafts: [], attention: [], departments: [], assignments: [] },
    },
    patches: [],
  };
}

export interface P2MotorServerDeps {
  readonly acl?: PilotAcl;
  readonly orchestratorAcl?: PilotAcl;
  readonly resolveNode?: ResolveNode;
}

export function createP2MotorServer(deps: P2MotorServerDeps = {}) {
  const acl = deps.acl ?? parseAcl(process.env.PILOT_P2_ACL);
  const orchestratorAcl = deps.orchestratorAcl ?? parseOrchestratorAcl(process.env.PILOT_P2_ORCHESTRATOR_ACL);
  const resolveNode = deps.resolveNode ?? whoisNode;
  const sessions = new Map<string, P2SessionState>();

  function sessionOf(stableId: string): P2SessionState {
    const existing = sessions.get(stableId);
    if (existing) return existing;
    const created = emptySession();
    sessions.set(stableId, created);
    return created;
  }

  function viewFor(session: P2SessionState) {
    const base = serializeFoundationView(HOME_TENANT_ID);
    if (!base) throw new Error("home_view_missing");
    return mergeReviewSession(base, session.roster, session.patches);
  }

  async function authorize(
    req: IncomingMessage,
    requestedWorkspace: string | null,
  ): Promise<
    | { ok: true; workspace: string; node: NodeIdentity; session: P2SessionState }
    | { ok: false; status: number; body: Record<string, unknown> }
  > {
    const ip = callerIp(req);
    const node = await resolveNode(ip);
    if (node === null) {
      return { ok: false, status: 403, body: { ok: false, error: "node_not_allowed" } };
    }
    const access = await accessCheck(req, requestedWorkspace, acl, async () => node);
    if ("error" in access) {
      return { ok: false, status: 403, body: { ok: false, error: access.error } };
    }
    if (access.workspace !== HOME_TENANT_ID) {
      return { ok: false, status: 403, body: { ok: false, error: "unknown_workspace" } };
    }
    return { ok: true, workspace: access.workspace, node, session: sessionOf(node.stableId) };
  }

  async function authorizeOrchestrator(
    req: IncomingMessage,
  ): Promise<{ ok: true } | { ok: false; status: number; body: Record<string, unknown> }> {
    const ip = callerIp(req);
    const node = await resolveNode(ip);
    if (node === null || !orchestratorAllowed(node.stableId, orchestratorAcl)) {
      return { ok: false, status: 403, body: { ok: false, error: "orchestrator_denied" } };
    }
    return { ok: true };
  }

  return createServer(async (req, res) => {
    try {
      const { pathname, searchParams } = pathOf(req);
      const method = req.method ?? "GET";

      if (method === "GET" && (pathname === "/motor/health" || pathname === "/motor/ready")) {
        const body = healthBody();
        if (healthLeaks(body)) {
          sendJson(res, 500, { ok: false, error: "health_leak" });
          return;
        }
        sendJson(res, 200, body);
        return;
      }

      if (pathname.startsWith("/motor/orchestrator")) {
        const gate = await authorizeOrchestrator(req);
        if (!gate.ok) {
          sendJson(res, gate.status, gate.body);
          return;
        }
        if (method === "GET" && (pathname === P2_ORCHESTRATOR_HEALTH_PATH || pathname === P2_ORCHESTRATOR_READY_PATH)) {
          const body = orchestratorBody();
          if (orchestratorBodyLeaks(body)) {
            sendJson(res, 500, { ok: false, error: "health_leak" });
            return;
          }
          sendJson(res, 200, body);
          return;
        }
        sendJson(res, 404, { ok: false, error: "not_found" });
        return;
      }

      if (pathname === "/draft" || pathname === "/decision" || pathname === "/drafts" || pathname === "/") {
        sendJson(res, 404, { ok: false, error: "not_p2_motor_route" });
        return;
      }

      if (pathname.startsWith("/motor/") && pathname !== "/motor/health" && pathname !== "/motor/ready") {
        const segment = pathname.slice("/motor/".length);
        if (segment === OTHER_TENANT_ID || (segment !== HOME_TENANT_ID && !segment.startsWith("orchestrator"))) {
          sendJson(res, 403, { ok: false, error: "tenant_denied" });
          return;
        }
      }

      const requested =
        searchParams.get("workspace") ??
        searchParams.get("tenant") ??
        (pathname.startsWith("/motor/") ? pathname.slice("/motor/".length) || null : null);

      if (method === "GET" && (pathname === "/motor" || pathname === `/motor/${HOME_TENANT_ID}`)) {
        const access = await authorize(req, requested && requested.length > 0 ? requested : HOME_TENANT_ID);
        if (!access.ok) {
          sendJson(res, access.status, access.body);
          return;
        }
        const shell = resolveMotorShell({
          authenticated: true,
          requested: {
            workspace: access.workspace,
            pathSegments: pathname === `/motor/${HOME_TENANT_ID}` ? [HOME_TENANT_ID] : [],
            query: Object.fromEntries(searchParams),
          },
          defaultHomeWorkspace: true,
        });
        if (!shell.ok) {
          sendJson(res, 403, { ok: false, error: shell.reason });
          return;
        }
        sendHtml(res, 200, renderMotorHtml(viewFor(access.session)));
        return;
      }

      if (method === "GET" && pathname === "/api/motor/view") {
        const access = await authorize(req, requested);
        if (!access.ok) {
          sendJson(res, access.status, access.body);
          return;
        }
        const view = viewFor(access.session);
        sendJson(res, 200, {
          ok: true,
          workspace: access.workspace,
          nav: view.nav.map((item) => item.label),
          now: view.now.items.map((item) => ({ id: item.id, title: item.title, stage: item.stage })),
          projects: view.projects.map((row) => ({
            id: row.project.id,
            name: row.project.name,
            drafts: row.drafts.map((draft) => ({ id: draft.id, title: draft.title, state: draft.state })),
          })),
          departments: view.departments.map((dep) => ({ id: dep.id, name: dep.name })),
        });
        return;
      }

      if (method === "GET" && pathname === "/api/motor/evidence") {
        const access = await authorize(req, requested);
        if (!access.ok) {
          sendJson(res, access.status, access.body);
          return;
        }
        const view = viewFor(access.session);
        const rail = openEvidenceRail({
          authenticated: true,
          workspace: access.workspace,
          view,
        });
        if (!rail.ok) {
          sendJson(res, 403, { ok: false, error: rail.reason });
          return;
        }
        if (
          evidenceRailLeaksContent(rail.rail, [
            FORBIDDEN_VIEW_MARKERS.secret,
            FORBIDDEN_VIEW_MARKERS.contextBody,
            FORBIDDEN_VIEW_MARKERS.rawRuntimeLog,
          ])
        ) {
          sendJson(res, 500, { ok: false, error: "evidence_leak" });
          return;
        }
        sendJson(res, 200, { ok: true, rail: collectWorkspaceEvidence(view) });
        return;
      }

      if (method !== "POST" || !pathname.startsWith("/api/motor/")) {
        sendJson(res, 404, { ok: false, error: "not_found" });
        return;
      }

      const contentType = req.headers["content-type"] ?? "";
      if (!contentType.startsWith("application/json")) {
        sendJson(res, 415, { ok: false, error: "content_type_must_be_json" });
        return;
      }

      const body = await readJsonBody(req);
      if ("context" in body) {
        sendJson(res, 400, { ok: false, error: "context_not_allowed" });
        return;
      }

      const bodyWorkspace = typeof body.workspace === "string" ? body.workspace : requested;
      const access = await authorize(req, bodyWorkspace);
      if (!access.ok) {
        sendJson(res, access.status, access.body);
        return;
      }

      if (pathname === "/api/motor/draft") {
        const prepared = prepareTypedDraft({
          authenticated: true,
          actorTenantId: access.workspace,
          workspaceId: access.workspace,
          projectId: String(body.projectId ?? ""),
          title: String(body.title ?? ""),
          body: typeof body.body === "string" ? body.body : undefined,
          nonce: typeof body.nonce === "string" ? body.nonce : undefined,
        });
        if (!prepared.ok) {
          sendJson(res, 400, { ok: false, error: prepared.reason });
          return;
        }
        const overlay: ShellOverlay = {
          ...access.session.roster.overlay,
          drafts: [...access.session.roster.overlay.drafts, prepared.draft],
          attention: [...access.session.roster.overlay.attention, prepared.attention],
        };
        access.session.roster = { ...access.session.roster, overlay };
        sendJson(res, 200, { ok: true, draftId: prepared.draft.id, state: prepared.draft.state });
        return;
      }

      if (pathname === "/api/motor/review/submit") {
        const view = viewFor(access.session);
        const submitted = submitDraftForReview({
          authenticated: true,
          actorTenantId: access.workspace,
          workspaceId: access.workspace,
          draftId: String(body.draftId ?? ""),
          view,
        });
        if (!submitted.ok) {
          sendJson(res, 400, { ok: false, error: submitted.reason });
          return;
        }
        access.session.patches = appendReviewPatch(access.session.patches, submitted.patch);
        sendJson(res, 200, { ok: true, status: submitted.patch.status, draftId: submitted.patch.draftId });
        return;
      }

      if (pathname === "/api/motor/review/decide") {
        const view = viewFor(access.session);
        const decision = body.decision === "reject" ? "reject" : body.decision === "approve" ? "approve" : null;
        if (!decision) {
          sendJson(res, 400, { ok: false, error: "invalid_transition" });
          return;
        }
        const decided = decideReview({
          authenticated: true,
          actorTenantId: access.workspace,
          workspaceId: access.workspace,
          draftId: String(body.draftId ?? ""),
          decision,
          view,
        });
        if (!decided.ok) {
          sendJson(res, 400, { ok: false, error: decided.reason });
          return;
        }
        access.session.patches = appendReviewPatch(access.session.patches, decided.patch);
        sendJson(res, 200, { ok: true, status: decided.patch.status, draftId: decided.patch.draftId });
        return;
      }

      if (pathname === "/api/motor/publish") {
        const attempt = tryPublish({
          authenticated: true,
          actorTenantId: access.workspace,
          workspaceId: access.workspace,
          draftId: typeof body.draftId === "string" ? body.draftId : undefined,
        });
        sendJson(res, 200, {
          ok: false,
          decision: attempt.decision,
          reason: attempt.reason,
          visible: attempt.visible,
        });
        return;
      }

      sendJson(res, 404, { ok: false, error: "not_found" });
    } catch (error) {
      sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

const isMain =
  typeof process.argv[1] === "string" && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const { host, port } = resolveP2Bind();
  const server = createP2MotorServer();
  server.listen(port, host, () => {
    process.stdout.write(`motor-p2-ui luistert op ${host}:${port} (/motor only)\n`);
  });
}
