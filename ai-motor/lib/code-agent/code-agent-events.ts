export type CodeAgentStreamEvent =
  | { type: "text"; content: string }
  | { type: "tool_call"; tool: string; input: Record<string, string> }
  | { type: "tool_result"; tool: string; result: string }
  | {
      type: "write_proposal";
      path: string;
      before: string;
      after: string;
    }
  | { type: "done"; changes: string[]; proposals?: string[] }
  | { type: "error"; error: string };
