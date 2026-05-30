import { NextRequest, NextResponse } from "next/server";
import {
  browserbaseCreateSession,
  browserbaseSessionDebugWithRetry,
  getBrowserbaseProjectId,
  isBrowserbaseConfigured,
} from "@/lib/browserbase-client";

export const runtime = "nodejs";

/**
 * Proxies Browserbase live-view URLs naar de Agent-UI — API-key blijft op de server.
 */
export async function POST(req: NextRequest) {
  try {
    if (!isBrowserbaseConfigured()) {
      return NextResponse.json(
        {
          error: "browserbase_not_configured",
          detail: "Zet BROWSERBASE_API_KEY in .env (zie docs/computer-use-n8n.md).",
        },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as {
      sessionId?: string;
      create?: boolean;
      timeout?: number;
      keepAlive?: boolean;
      projectId?: string;
    };

    let sessionId = body.sessionId?.trim();

    if (!sessionId && body.create) {
      const projectId = body.projectId?.trim() || getBrowserbaseProjectId() || undefined;
      const payload: Record<string, unknown> = {};
      if (projectId) payload.projectId = projectId;
      if (typeof body.keepAlive === "boolean") payload.keepAlive = body.keepAlive;
      if (typeof body.timeout === "number" && Number.isFinite(body.timeout)) {
        payload.timeout = body.timeout;
      }

      const created = await browserbaseCreateSession(payload);
      sessionId = typeof created.id === "string" ? created.id : "";
      if (!sessionId) {
        return NextResponse.json(
          { error: "browserbase_create_failed", detail: "Geen session id ontvangen." },
          { status: 502 }
        );
      }
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: "session_id_required", detail: "Geef sessionId of create=true." },
        { status: 400 }
      );
    }

    const live = await browserbaseSessionDebugWithRetry(sessionId);
    return NextResponse.json({
      ok: true,
      sessionId,
      debuggerFullscreenUrl:
        typeof live.debuggerFullscreenUrl === "string" ? live.debuggerFullscreenUrl : null,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "browserbase", detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
