import type { ChatIntent } from "@/lib/intent-detection";
import {
  callLocalExecutor,
  isLocalExecutorConfigured,
} from "@/lib/local-executor";
import {
  formatLocalExecutorMessage,
  parseLocalActionFromPrompt,
  shouldUseLocalExecutor,
} from "@/lib/local-action";

export type LocalChatHandleResult = {
  handled: boolean;
  message?: string;
  local_action?: boolean;
  local_op?: string;
};

/**
 * Probeert een NUC-local actie uit te voeren. Bij succes: volledig antwoord voor chat.
 */
export async function tryHandleLocalExecutorChat(
  prompt: string,
  intent: ChatIntent,
  agentMode: boolean
): Promise<LocalChatHandleResult> {
  if (!shouldUseLocalExecutor(prompt, intent, { agentMode })) {
    return { handled: false };
  }
  if (!isLocalExecutorConfigured()) {
    return { handled: false };
  }

  const action = parseLocalActionFromPrompt(prompt);
  if (!action) {
    return {
      handled: false,
    };
  }

  const result = await callLocalExecutor(action);
  const message = formatLocalExecutorMessage(action, result);
  return {
    handled: true,
    message,
    local_action: true,
    local_op: action.op,
  };
}
