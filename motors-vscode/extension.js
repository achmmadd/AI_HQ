const vscode = require("vscode");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");

function getConfig() {
  const cfg = vscode.workspace.getConfiguration("motorsai");
  return {
    baseUrl: (cfg.get("baseUrl") || "https://motorsai.app").replace(/\/$/, ""),
    klant: cfg.get("klant") || "system",
    token: cfg.get("token") || "",
    workspace: cfg.get("workspace") || "",
    bridgePath: cfg.get("bridgePath") || "",
  };
}

function authHeaders(token) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Cookie = `motorsai_token=${token}`;
  return headers;
}

function resolveBridgeCli(customPath) {
  if (customPath && fs.existsSync(customPath)) return customPath;
  const candidates = [
    path.join(os.homedir(), "AI_HQ/tools/motors-pc-bridge/index.js"),
    path.join(os.homedir(), "AI_HQ/ai-motor/tools/motors-pc-bridge/index.js"),
  ];
  return candidates.find((p) => fs.existsSync(p)) || null;
}

function openBridgeDocs() {
  const doc = [
    "MotorsAI PC Bridge — start in een terminal:",
    "",
    "  cd ~/AI_HQ/tools/motors-pc-bridge",
    "  node index.js register --url https://motorsai.app --workspace .",
    "  node index.js poll",
    "",
    "Of installeer global: npm link in tools/motors-pc-bridge",
    "Daarna: motors-pc-bridge register && motors-pc-bridge poll",
    "",
    "Bridge-koppeling beheren: https://motorsai.app/cowork?tab=bridge",
  ].join("\n");
  vscode.window.showInformationMessage(
    "MotorsAI bridge CLI — zie Output > MotorsAI Bridge voor instructies"
  );
  const channel = vscode.window.createOutputChannel("MotorsAI Bridge");
  channel.clear();
  channel.appendLine(doc);
  channel.show(true);
}

async function startBridge() {
  const { baseUrl, bridgePath } = getConfig();
  const cli = resolveBridgeCli(bridgePath);
  const workspace =
    vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

  if (!cli) {
    openBridgeDocs();
    return;
  }

  const node = process.execPath;
  const term =
    vscode.window.terminals.find((t) => t.name === "MotorsAI Bridge") ||
    vscode.window.createTerminal({
      name: "MotorsAI Bridge",
      cwd: workspace,
    });

  term.show(true);
  term.sendText(
    `${node} ${JSON.stringify(cli)} register --url ${JSON.stringify(baseUrl)} --workspace ${JSON.stringify(workspace)}`
  );
  term.sendText(`${node} ${JSON.stringify(cli)} poll`);

  vscode.window.showInformationMessage(
    "MotorsAI bridge gestart in terminal — laat poll draaien."
  );
}

async function openCode() {
  const { baseUrl, klant, workspace } = getConfig();
  const folder = vscode.workspace.workspaceFolders?.[0]?.name?.trim();
  const ws = workspace || folder || "";
  const params = new URLSearchParams({ klant });
  if (ws) params.set("workspace", ws);
  const url = `${baseUrl}/code?${params.toString()}`;
  await vscode.env.openExternal(vscode.Uri.parse(url));
}

async function streamCodeAgent(body, onDelta) {
  const { baseUrl, token } = getConfig();
  const res = await fetch(`${baseUrl}/api/code/agent`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg =
      typeof err.error === "string"
        ? err.error
        : `HTTP ${res.status}`;
    if (err.code === "executor_offline") {
      throw new Error(
        `${msg} — open ${baseUrl}/cowork?tab=bridge om je laptop te koppelen.`
      );
    }
    throw new Error(msg);
  }

  if (!res.body) throw new Error("Geen stream body");
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let message = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() || "";
    for (const line of lines.filter(Boolean)) {
      try {
        const chunk = JSON.parse(line);
        if (chunk.type === "text" && chunk.content) {
          message += chunk.content;
          onDelta(chunk.content);
        }
        if (chunk.type === "error") {
          throw new Error(chunk.error || "agent error");
        }
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  return message;
}

async function sendSelection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage("Geen actief editor-venster.");
    return;
  }

  const { klant, workspace: cfgWorkspace } = getConfig();
  let workspace =
    cfgWorkspace ||
    vscode.workspace.workspaceFolders?.[0]?.name?.trim() ||
    "";
  if (!workspace) {
    const picked = await vscode.window.showInputBox({
      prompt: "Motor Code workspace slug (projectnaam op motorsai.app/code)",
      placeHolder: "mijn-app",
    });
    if (!picked?.trim()) return;
    workspace = picked.trim();
    await vscode.workspace
      .getConfiguration("motorsai")
      .update("workspace", workspace, vscode.ConfigurationTarget.Workspace);
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showWarningMessage("Selecteer eerst code om naar de agent te sturen.");
    return;
  }

  const prompt = await vscode.window.showInputBox({
    prompt: "Wat wil je doen met deze selectie?",
    placeHolder: "Refactor / leg uit / fix bug…",
  });
  if (!prompt?.trim()) return;

  const doc = editor.document;
  const relPath = vscode.workspace.asRelativePath(doc.uri, false);
  const text = doc.getText(selection);
  const startLine = selection.start.line + 1;
  const endLine = selection.end.line + 1;

  const channel = vscode.window.createOutputChannel("MotorsAI Code Agent");
  channel.show(true);
  channel.appendLine(`> ${prompt}\n`);
  channel.appendLine(`Selectie: ${relPath}:${startLine}-${endLine}\n`);

  try {
    await streamCodeAgent(
      {
        klant,
        workspace,
        message: prompt.trim(),
        history: [],
        openFiles: [relPath],
        selection: {
          path: relPath,
          startLine,
          endLine,
          text,
        },
        reviewWrites: true,
      },
      (chunk) => channel.append(chunk)
    );
    channel.appendLine("\n");
  } catch (e) {
    vscode.window.showErrorMessage(
      e instanceof Error ? e.message : String(e)
    );
  }
}

async function streamChat(prompt, onDelta) {
  const { baseUrl, klant, token } = getConfig();
  const res = await fetch(`${baseUrl}/api/chat/stream`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      prompt,
      klant,
      agent_mode: false,
      context: [],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No stream body");
  const dec = new TextDecoder();
  let buf = "";
  let message = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() || "";
    for (const part of parts) {
      const line = part.split("\n").find((l) => l.startsWith("data: "));
      if (!line) continue;
      try {
        const ev = JSON.parse(line.slice(6));
        if (ev.type === "delta" && ev.text) {
          message += ev.text;
          onDelta(ev.text);
        }
        if (ev.type === "done" && ev.message) message = ev.message;
        if (ev.type === "error") throw new Error(ev.message || "stream error");
      } catch {
        /* skip */
      }
    }
  }
  return message;
}

function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand("motorsai.setToken", async () => {
      const token = await vscode.window.showInputBox({
        prompt: "MotorsAI session token (motorsai_token cookie value)",
        password: true,
      });
      if (token === undefined) return;
      await vscode.workspace
        .getConfiguration("motorsai")
        .update("token", token, vscode.ConfigurationTarget.Global);
      vscode.window.showInformationMessage("MotorsAI token saved.");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("motorsai.openChat", async () => {
      const prompt = await vscode.window.showInputBox({
        prompt: "MotorsAI — stel je vraag",
        placeHolder: "Bouw / vraag / codeer…",
      });
      if (!prompt?.trim()) return;

      const channel = vscode.window.createOutputChannel("MotorsAI");
      channel.show(true);
      channel.appendLine(`> ${prompt}\n`);

      try {
        await streamChat(prompt.trim(), (chunk) => channel.append(chunk));
        channel.appendLine("\n");
      } catch (e) {
        vscode.window.showErrorMessage(
          e instanceof Error ? e.message : String(e)
        );
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("motors.startBridge", () => {
      void startBridge();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("motors.openCode", () => {
      void openCode();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("motors.sendSelection", () => {
      void sendSelection();
    })
  );
}

function deactivate() {}

module.exports = { activate, deactivate };
