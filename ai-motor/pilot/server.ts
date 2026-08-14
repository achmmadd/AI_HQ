/**
 * server.ts — Motor shadow-pilot API (trede 1 naar "live").
 *
 * Minimale HTTP-dienst om dezelfde draft-core als de CLI te serveren:
 *
 *   GET  /health  → { ok, model bereikbaar? }
 *   POST /draft   → body {"review": "...", "context": "..." (optioneel)}
 *                   → dezelfde output als run-shadow.ts (draft + evidence)
 *
 * Netwerkgrens: compose bindt de poort uitsluitend aan het Tailscale-IP van
 * Hetzner; er is geen publieke poort en geen auth-laag — het tailnet ís de
 * grens. Publiceren blijft handmatig: de gateway-probe in runDraft bewijst
 * per run dat de publish-capability DENY krijgt.
 */

import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

import {
  DEFAULT_CONTEXT,
  SYNTHETIC_REVIEW,
  runDraft,
} from "./draft-core.ts";

const UI_HTML = new URL("./ui.html", import.meta.url);

const PORT = Number(process.env.PILOT_API_PORT ?? "4400");
const MODEL_PORT_URL =
  process.env.MODEL_PORT_URL ?? "http://100.118.204.123:8080";
const MAX_BODY_BYTES = 64 * 1024;

function sendJson(
  res: import("node:http").ServerResponse,
  status: number,
  body: unknown,
) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    // Tailnet-only dienst; de UI draait op een andere node (NUC).
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  res.end(payload);
}

async function readBody(
  req: import("node:http").IncomingMessage,
): Promise<string> {
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

const server = createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 204, null);
      return;
    }
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
    if (req.method === "POST" && req.url === "/draft") {
      const raw = await readBody(req);
      let body: { review?: unknown; context?: unknown };
      try {
        body = JSON.parse(raw) as typeof body;
      } catch {
        sendJson(res, 400, { ok: false, error: "body must be JSON" });
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
      const context =
        typeof body.context === "string" && body.context.trim()
          ? body.context
          : DEFAULT_CONTEXT;
      const output = await runDraft({
        reviewText: review,
        contextText: context,
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

server.listen(PORT, () => {
  process.stdout.write(
    `motor-pilot API luistert op :${PORT} (model: ${MODEL_PORT_URL})\n`,
  );
});
