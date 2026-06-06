import { NextRequest } from "next/server";
import { runCodeAgentStream } from "@/lib/code-agent/run-code-agent";
import { resolveReviewWrites } from "@/lib/code-agent/review-writes-policy";
import {
  parseCodeKlant,
  validateProjectSlug,
} from "@/lib/code-workspace";
import { getCodeExecutorStatus } from "@/lib/code-executor";
import { isCodeAgentConfigured } from "@/lib/code-agent/code-models";
import { rateLimitResponse } from "@/lib/api-rate-limit";
import {
  appendSessionMessage,
  getCodeSession,
  touchCodeSession,
} from "@/lib/code-sessions";
import { checkBudgetBeforeUsage } from "@/lib/usage-budget";
import { requireApiAuthForKlant } from "@/lib/require-api-auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const limited = rateLimitResponse(req, "/api/code/agent", 20, 10 * 60 * 1000);
  if (limited) return limited;

  const body = await req.json().catch(() => ({}));
  const klant = parseCodeKlant(typeof body.klant === "string" ? body.klant : null);

  const auth = await requireApiAuthForKlant(req, klant);
  if (auth instanceof Response) return auth;
  const { session } = auth;

  const project =
    typeof body.workspace === "string"
      ? body.workspace.trim()
      : typeof body.project === "string"
        ? body.project.trim()
        : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const history = Array.isArray(body.history) ? body.history : [];
  const openFiles = Array.isArray(body.openFiles) ? body.openFiles : [];
  const sessionId =
    typeof body.sessionId === "number"
      ? body.sessionId
      : Number(body.sessionId) || null;
  const terminalOutput =
    typeof body.terminalOutput === "string" ? body.terminalOutput : null;
  const selection =
    body.selection &&
    typeof body.selection === "object" &&
    typeof body.selection.path === "string" &&
    typeof body.selection.text === "string"
      ? {
          path: body.selection.path.trim(),
          startLine: Number(body.selection.startLine) || 1,
          endLine: Number(body.selection.endLine) || 1,
          text: body.selection.text,
        }
      : null;
  const reviewWrites = resolveReviewWrites(
    session,
    body.reviewWrites !== false
  );

  if (!project || !validateProjectSlug(project)) {
    return new Response(JSON.stringify({ error: "workspace vereist" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!message) {
    return new Response(JSON.stringify({ error: "message vereist" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!isCodeAgentConfigured()) {
    return new Response(
      JSON.stringify({
        error:
          "Geen code-agent LLM — zet OPENROUTER_API_KEY of ANTHROPIC_API_KEY",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const budget = checkBudgetBeforeUsage(klant);
  if (!budget.allowed) {
    return new Response(
      JSON.stringify({
        error: `Maandbudget bereikt voor ${klant} (€${budget.status?.spentEur.toFixed(2)})`,
        code: "budget_exceeded",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );
  }

  if (sessionId) {
    const sess = getCodeSession(sessionId);
    if (!sess || sess.klant !== klant || sess.workspace !== project) {
      return new Response(JSON.stringify({ error: "ongeldige sessionId" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    appendSessionMessage({ sessionId, role: "user", content: message });
  }
  const execStatus = await getCodeExecutorStatus();
  if (execStatus.active === "none") {
    return new Response(
      JSON.stringify({
        error:
          "Geen executor bereikbaar — start de NUC executor of koppel je laptop via PC bridge.",
        code: "executor_offline",
        bridge_setup_url: "/cowork?tab=bridge",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  const encoder = new TextEncoder();
  let fullAssistant = "";
  const stream = new ReadableStream({
    async start(controller) {
      const push = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      await runCodeAgentStream({
        klant,
        project,
        message,
        terminalOutput,
        history: history
          .filter(
            (m: unknown) =>
              m &&
              typeof m === "object" &&
              "role" in m &&
              "content" in m &&
              ((m as { role: string }).role === "user" ||
                (m as { role: string }).role === "assistant")
          )
          .map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: String(m.content),
          })),
        openFiles: openFiles.filter((f: unknown) => typeof f === "string"),
        selection,
        reviewWrites,
        onEvent: (ev) => {
          if (ev.type === "text" && ev.content) fullAssistant += ev.content;
          push(ev);
        },
      });
      if (sessionId && fullAssistant.trim()) {
        appendSessionMessage({
          sessionId,
          role: "assistant",
          content: fullAssistant,
        });
        touchCodeSession(sessionId);
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
