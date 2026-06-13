import { buildCodeSystemPrompt } from "@/lib/code-agent/code-system-prompt";
import {
  getMotorCodeModel,
  resolveCodeModelForTurn,
} from "@/lib/code-agent/code-models";
import {
  enrichCodeAgentMessage,
  type CodeSelectionContext,
} from "@/lib/code-agent/message-context";
import {
  buildOpenRouterToolResultMessages,
  createOpenRouterCodeMessage,
  type OpenRouterChatMessage,
} from "@/lib/code-agent/openrouter-tools";
import { formatOpenRouterUserError } from "@/lib/openrouter-errors";
import { executeCodeAgentTool } from "@/lib/code-agent/execute-tool";
import type { CodeAgentToolName } from "@/lib/code-agent/tools";
import { logMotorChatUsage } from "@/lib/chat-usage";
import { estimateTokens } from "@/lib/chat-usage-labels";
import type { CodeAgentStreamEvent } from "@/lib/code-agent/code-agent-events";

const MAX_TURNS = 12;

async function runTool(
  tu: { name: string; input: Record<string, string> },
  opts: {
    klant: string;
    project: string;
    reviewWrites: boolean;
    onEvent: (ev: CodeAgentStreamEvent) => void;
    proposals: string[];
    changes: string[];
  }
): Promise<string> {
  opts.onEvent({
    type: "tool_call",
    tool: tu.name,
    input: tu.input,
  });

  let result: string;
  let wrotePath: string | undefined;

  if (tu.name === "write_file" && opts.reviewWrites !== false) {
    const rel = tu.input.path?.trim();
    const after = tu.input.content ?? "";
    if (!rel) {
      result = "path vereist";
    } else {
      const read = await executeCodeAgentTool(
        "read_file",
        { path: rel },
        opts.klant,
        opts.project
      );
      const before =
        read.result.startsWith("❌") || read.result === "(leeg bestand)"
          ? ""
          : read.result;
      opts.onEvent({ type: "write_proposal", path: rel, before, after });
      if (!opts.proposals.includes(rel)) opts.proposals.push(rel);
      result = `⏳ Voorstel voor ${rel} — keur goed in diff-review`;
    }
  } else {
    const exec = await executeCodeAgentTool(
      tu.name as CodeAgentToolName,
      tu.input,
      opts.klant,
      opts.project
    );
    result = exec.result;
    wrotePath = exec.wrotePath;
  }

  if (wrotePath && !opts.changes.includes(wrotePath)) {
    opts.changes.push(wrotePath);
  }

  opts.onEvent({
    type: "tool_result",
    tool: tu.name,
    result: result.slice(0, 500),
  });

  return result;
}

export async function runOpenRouterCodeAgentStream(opts: {
  klant: string;
  project: string;
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  openFiles: string[];
  sessionId?: number | null;
  selection?: CodeSelectionContext | null;
  terminalOutput?: string | null;
  reviewWrites?: boolean;
  onEvent: (ev: CodeAgentStreamEvent) => void;
}): Promise<void> {
  const started = Date.now();
  const changes: string[] = [];
  const proposals: string[] = [];
  let fullAssistantText = "";
  let totalInput = 0;
  let totalOutput = 0;
  let model = getMotorCodeModel("openrouter");

  const system = await buildCodeSystemPrompt({
    klant: opts.klant,
    project: opts.project,
    openFiles: opts.openFiles,
    userMessage: opts.message,
    sessionId: opts.sessionId,
  });

  const userContent = await enrichCodeAgentMessage({
    klant: opts.klant,
    project: opts.project,
    message: opts.message,
    selection: opts.selection,
    terminalOutput: opts.terminalOutput,
  });

  const messages: OpenRouterChatMessage[] = [
    ...opts.history.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: "user" as const, content: userContent },
  ];

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      model = resolveCodeModelForTurn(
        {
          message: opts.message,
          historyLength: opts.history.length,
          turn,
          openFilesCount: opts.openFiles.length,
          hasTerminalOutput: Boolean(opts.terminalOutput),
          hasSelection: Boolean(opts.selection),
        },
        "openrouter"
      );

      const response = await createOpenRouterCodeMessage({
        system,
        messages,
        model,
      });

      if (response.usage?.input_tokens) totalInput += response.usage.input_tokens;
      if (response.usage?.output_tokens) totalOutput += response.usage.output_tokens;

      if (response.text) {
        fullAssistantText += response.text;
        opts.onEvent({ type: "text", content: response.text });
      }

      if (!response.toolCalls.length) break;

      const results: string[] = [];
      for (const tu of response.toolCalls) {
        results.push(
          await runTool(tu, {
            klant: opts.klant,
            project: opts.project,
            reviewWrites: opts.reviewWrites !== false,
            onEvent: opts.onEvent,
            proposals,
            changes,
          })
        );
      }

      messages.push(response.assistantMessage);
      messages.push(...buildOpenRouterToolResultMessages(response.toolCalls, results));
    }

    opts.onEvent({
      type: "done",
      changes,
      proposals: proposals.length ? proposals : undefined,
    });

    logMotorChatUsage({
      klant: opts.klant,
      model: `openrouter:${model}`,
      agentLabel: "motor-code",
      promptTokens: totalInput || estimateTokens(opts.message),
      completionTokens: totalOutput || estimateTokens(fullAssistantText),
      durationMs: Date.now() - started,
      prompt: opts.message,
      response: fullAssistantText,
    });
  } catch (e) {
    const msg = formatOpenRouterUserError(
      e instanceof Error ? e.message : String(e)
    );
    opts.onEvent({ type: "error", error: msg });
    logMotorChatUsage({
      klant: opts.klant,
      model: `openrouter:${model}`,
      agentLabel: "motor-code",
      promptTokens: estimateTokens(opts.message),
      completionTokens: 0,
      durationMs: Date.now() - started,
      prompt: opts.message,
      response: msg,
      success: false,
    });
  }
}
