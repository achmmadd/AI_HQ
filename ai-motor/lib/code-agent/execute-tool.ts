import { callCodeExecutor } from "@/lib/code-executor";
import {
  executorFilePath,
  executorProjectPath,
  searchCodebase,
} from "@/lib/code-workspace";
import type { CodeAgentToolName } from "@/lib/code-agent/tools";

export async function executeCodeAgentTool(
  name: CodeAgentToolName,
  input: Record<string, string>,
  klant: string,
  project: string
): Promise<{ result: string; wrotePath?: string }> {
  const projectPath = executorProjectPath(klant, project);

  switch (name) {
    case "read_file": {
      const rel = input.path?.trim();
      if (!rel) return { result: "path vereist" };
      const r = await callCodeExecutor({
        op: "read_file",
        path: executorFilePath(klant, project, rel),
      });
      if (!r.ok) return { result: `❌ ${r.error ?? "read failed"}` };
      const content = String(r.data?.content ?? "");
      return { result: content || "(leeg bestand)" };
    }
    case "write_file": {
      const rel = input.path?.trim();
      if (!rel) return { result: "path vereist" };
      const r = await callCodeExecutor({
        op: "write_file",
        path: executorFilePath(klant, project, rel),
        content: input.content ?? "",
      });
      if (!r.ok) return { result: `❌ ${r.error ?? "write failed"}` };
      return {
        result: `✅ Bestand geschreven: ${rel}`,
        wrotePath: rel,
      };
    }
    case "list_files": {
      const dir = input.directory?.trim() || ".";
      const listPath =
        dir === "."
          ? projectPath
          : executorFilePath(klant, project, dir);
      const r = await callCodeExecutor({ op: "list_dir", path: listPath });
      if (!r.ok) return { result: `❌ ${r.error ?? "list failed"}` };
      const entries = r.data?.entries;
      if (Array.isArray(entries)) {
        return { result: entries.join("\n") || "(leeg)" };
      }
      return { result: String(r.data?.raw ?? "(leeg)") };
    }
    case "run_command": {
      const cmd = input.command?.trim();
      if (!cmd) return { result: "command vereist" };
      const r = await callCodeExecutor({
        op: "run_command",
        command: cmd,
        cwd: projectPath,
      });
      if (!r.ok && !r.data?.stdout && !r.data?.stderr) {
        return { result: `❌ ${r.error ?? "command failed"}` };
      }
      const stdout = String(r.data?.stdout ?? "");
      const stderr = String(r.data?.stderr ?? "");
      const exit = r.data?.exit_code;
      return {
        result: [stdout, stderr ? `STDERR:\n${stderr}` : "", `exit_code=${exit}`]
          .filter(Boolean)
          .join("\n"),
      };
    }
    case "search_codebase": {
      const q = input.query?.trim();
      if (!q) return { result: "query vereist" };
      const hits = await searchCodebase(
        klant,
        project,
        q,
        input.filePattern?.trim() || "*"
      );
      return { result: hits };
    }
    default:
      return { result: `Onbekende tool: ${name}` };
  }
}
