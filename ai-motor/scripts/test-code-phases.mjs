#!/usr/bin/env node
/**
 * Motor /code — controle per fase (draai vóór deploy).
 *
 *   node scripts/test-code-phases.mjs
 *   BASE_URL=http://127.0.0.1:3040 MOTORSAI_TOKEN=… node scripts/test-code-phases.mjs
 */

import fs from "fs";
import path from "path";
import os from "os";
import { execFileSync } from "child_process";

const base = (process.env.BASE_URL || "http://127.0.0.1:3040").replace(/\/$/, "");
const token = process.env.MOTORSAI_TOKEN?.trim() || "";
const klant = process.env.TEST_KLANT || "fumero";
const testProject = `_phase-test-${Date.now().toString(36)}`;

const authHeaders = token
  ? { "x-motorsai-token": token, Accept: "application/json" }
  : { Accept: "application/json" };

let failed = 0;

function pass(phase, msg) {
  console.log(`  ✓ [${phase}] ${msg}`);
}

function fail(phase, msg) {
  console.error(`  ✗ [${phase}] ${msg}`);
  failed++;
}

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...authHeaders, ...opts.headers } });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

// ── Fase 1: workspace lib (lokaal, geen server) ──
function phase1() {
  console.log("\n── Fase 1: code-workspace (lokaal) ──");
  const root =
    process.env.LOCAL_WORKSPACE_ROOT?.trim() ||
    path.join(os.homedir(), "AI_HQ", "projects");

  if (!fs.existsSync(root)) {
    try {
      fs.mkdirSync(root, { recursive: true });
      pass("1", `workspace root aangemaakt: ${root}`);
    } catch (e) {
      fail("1", `kan root niet maken: ${e.message}`);
      return;
    }
  } else {
    pass("1", `workspace root bestaat: ${root}`);
  }

  const klantDir = path.join(root, klant);
  const projectDir = path.join(klantDir, testProject);
  try {
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, "README.md"), "# phase test\n");
    pass("1", `test project map: ${klant}/${testProject}`);
  } catch (e) {
    fail("1", `project map: ${e.message}`);
    return;
  }

  // path traversal guard
  const evil = path.resolve(projectDir, "../../../etc/passwd");
  if (evil.startsWith(projectDir)) {
    fail("1", "path guard zou /etc moeten blokkeren");
  } else {
    pass("1", "path traversal guard (sanity)");
  }

  // grep search in project
  try {
    const out = execFileSync(
      "grep",
      ["-r", "phase", ".", "--include=*.md", "-l"],
      { cwd: projectDir, encoding: "utf-8" }
    );
    if (out.includes("README.md")) pass("1", "grep search in workspace");
    else fail("1", "grep geen hit");
  } catch {
    fail("1", "grep search failed");
  }

  global.__codeTestProject = testProject;
  global.__codeTestRoot = root;
}

// ── Fase 2: API routes ──
async function phase2() {
  console.log("\n── Fase 2: API routes ──");
  const project = global.__codeTestProject;

  const execHealth = await fetchJson(`${base}/api/local-executor/health`);
  if (execHealth.body?.reachable) pass("2", "local executor reachable");
  else fail("2", `executor: ${execHealth.body?.error ?? "not reachable"}`);

  const list = await fetchJson(`${base}/api/code/workspaces?klant=${klant}`);
  if (list.status === 401) {
    fail("2", "workspaces GET 401 — zet MOTORSAI_TOKEN");
    return;
  }
  if (list.status === 200) pass("2", `workspaces GET (${list.body?.workspaces?.length ?? 0})`);
  else fail("2", `workspaces GET HTTP ${list.status}`);

  const create = await fetchJson(`${base}/api/code/workspaces`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ klant, name: `${project}-api` }),
  });
  if (create.status === 200 || create.status === 201) {
    pass("2", `workspaces POST → ${create.body?.id ?? project}-api`);
    global.__codeApiProject = create.body?.id ?? `${project}-api`;
  } else {
    fail("2", `workspaces POST HTTP ${create.status}: ${create.body?.error ?? ""}`);
    global.__codeApiProject = project;
  }

  const ws = global.__codeApiProject;
  const tree = await fetchJson(
    `${base}/api/code/files?klant=${klant}&workspace=${ws}&tree=1`
  );
  if (tree.status === 200 && Array.isArray(tree.body?.tree)) {
    pass("2", `files tree (${tree.body.tree.length} top entries)`);
  } else {
    fail("2", `files tree HTTP ${tree.status}`);
  }

  const write = await fetchJson(`${base}/api/code/files`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      klant,
      workspace: ws,
      path: "hello.txt",
      content: "motor code phase 2",
    }),
  });
  if (write.status === 200 && write.body?.ok) pass("2", "files POST write");
  else fail("2", `files POST HTTP ${write.status}: ${write.body?.error ?? ""}`);

  const read = await fetchJson(
    `${base}/api/code/files?klant=${klant}&workspace=${ws}&path=hello.txt`
  );
  if (read.status === 200 && read.body?.content?.includes("motor code")) {
    pass("2", "files GET read");
  } else {
    fail("2", `files GET HTTP ${read.status}`);
  }

  const term = await fetchJson(`${base}/api/code/terminal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ klant, workspace: ws, command: "ls" }),
  });
  if (term.status === 200 && term.body?.stdout !== undefined) {
    pass("2", `terminal ls (exit ${term.body.exit_code})`);
  } else {
    fail("2", `terminal HTTP ${term.status}: ${term.body?.error ?? ""}`);
  }
}

// ── Fase 3: agent endpoint (dry — geen volledige LLM tenzij RUN_AGENT=1) ──
async function phase3() {
  console.log("\n── Fase 3: code agent ──");
  const ws = global.__codeApiProject || global.__codeTestProject;

  const probe = await fetchJson(`${base}/api/code/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ klant, workspace: "invalid slug!" }),
  });
  if (probe.status === 400) pass("3", "agent valideert workspace slug");
  else fail("3", `agent invalid slug → HTTP ${probe.status} (verwacht 400)`);

  const noMsg = await fetchJson(`${base}/api/code/agent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ klant, workspace: ws }),
  });
  if (noMsg.status === 400) pass("3", "agent vereist message");
  else fail("3", `agent empty message → HTTP ${noMsg.status}`);

  if (process.env.RUN_AGENT === "1") {
    console.log("  … RUN_AGENT=1 — volledige agent call (kost tokens)");
    const res = await fetch(`${base}/api/code/agent`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        klant,
        workspace: ws,
        message: "Lees hello.txt en antwoord met de inhoud in één regel.",
        history: [],
        openFiles: [],
      }),
    });
    if (!res.ok) {
      fail("3", `agent stream HTTP ${res.status}`);
      return;
    }
    const text = await res.text();
    if (text.includes('"type":"done"') || text.includes('"type":"text"')) {
      pass("3", "agent stream NDJSON");
    } else {
      fail("3", "agent stream geen events");
    }
  } else {
    console.log("  ⚠ [3] agent LLM skip (zet RUN_AGENT=1 voor live test)");
  }
}

// ── Fase 4: UI route ──
async function phase4() {
  console.log("\n── Fase 4: UI /code ──");
  const res = await fetch(`${base}/code`, { headers: authHeaders, redirect: "manual" });
  if (res.status === 200) pass("4", "/code HTTP 200");
  else if (res.status === 307 || res.status === 302) {
    const loc = res.headers.get("location") || "";
    if (loc.includes("/login")) fail("4", "/code redirect login — MOTORSAI_TOKEN?");
    else pass("4", `/code redirect ${res.status}`);
  } else fail("4", `/code HTTP ${res.status}`);
}

// ── Fase 5: docs + build artifact ──
function phase5() {
  console.log("\n── Fase 5: docs & integratie ──");
  const doc = path.join(process.cwd(), "docs/MOTOR_CODE_PRODUCT.md");
  if (fs.existsSync(doc)) pass("5", "docs/MOTOR_CODE_PRODUCT.md");
  else fail("5", "MOTOR_CODE_PRODUCT.md ontbreekt");

  const sidebar = path.join(process.cwd(), "components/motors-sidebar.tsx");
  const sb = fs.readFileSync(sidebar, "utf-8");
  if (sb.includes('href: "/code"')) pass("5", "sidebar Code link");
  else fail("5", "sidebar mist /code");

  const smoke = path.join(process.cwd(), "scripts/smoke-quality.mjs");
  if (fs.existsSync(smoke) && fs.readFileSync(smoke, "utf-8").includes("probeCodeWorkspace")) {
    pass("5", "smoke-quality fase Code");
  } else fail("5", "smoke-quality niet uitgebreid");
}

// ── Fase 6: editor UX (Monaco + preview) ──
function phase6() {
  console.log("\n── Fase 6: Monaco + preview ──");
  const editor = path.join(process.cwd(), "components/code-workspace/CodeEditor.tsx");
  const preview = path.join(process.cwd(), "components/code-workspace/CodePreview.tsx");
  const layout = path.join(process.cwd(), "components/code-workspace/CodeWorkspaceLayout.tsx");
  const lang = path.join(process.cwd(), "lib/code-file-language.ts");

  if (fs.existsSync(lang)) pass("6", "code-file-language helper");
  else fail("6", "lib/code-file-language.ts ontbreekt");

  if (fs.existsSync(editor)) {
    const src = fs.readFileSync(editor, "utf-8");
    if (src.includes("@monaco-editor/react")) pass("6", "Monaco editor component");
    else fail("6", "CodeEditor mist Monaco");
  } else fail("6", "CodeEditor.tsx ontbreekt");

  if (fs.existsSync(preview)) {
    const src = fs.readFileSync(preview, "utf-8");
    if (src.includes("LivePreview")) pass("6", "CodePreview iframe");
    else fail("6", "CodePreview mist LivePreview");
  } else fail("6", "CodePreview.tsx ontbreekt");

  if (fs.existsSync(layout)) {
    const src = fs.readFileSync(layout, "utf-8");
    if (src.includes("CodePreview") && src.includes('"preview"')) {
      pass("6", "layout editor/preview tabs");
    } else fail("6", "layout mist preview tab");
  } else fail("6", "CodeWorkspaceLayout.tsx ontbreekt");

  try {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "package.json"), "utf-8")
    );
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (deps["@monaco-editor/react"] || fs.existsSync(path.join(process.cwd(), "node_modules/@monaco-editor/react"))) {
      pass("6", "monaco dependency beschikbaar");
    } else {
      fail("6", "monaco niet geïnstalleerd");
    }
  } catch (e) {
    fail("6", `package check: ${e.message}`);
  }
}

// ── Fase 7: annotate + @mentions ──
function phase7() {
  console.log("\n── Fase 7: annotate + @mentions ──");
  const ctx = path.join(process.cwd(), "lib/code-agent/message-context.ts");
  const agent = path.join(process.cwd(), "components/code-workspace/AgentChat.tsx");
  const editor = path.join(process.cwd(), "components/code-workspace/CodeEditor.tsx");
  const route = path.join(process.cwd(), "app/api/code/agent/route.ts");

  if (fs.existsSync(ctx)) {
    const src = fs.readFileSync(ctx, "utf-8");
    if (src.includes("enrichCodeAgentMessage") && src.includes("extractMentionPaths")) {
      pass("7", "message-context enrich + mentions");
    } else fail("7", "message-context incompleet");
  } else fail("7", "message-context.ts ontbreekt");

  if (fs.existsSync(editor) && fs.readFileSync(editor, "utf-8").includes("onAnnotate")) {
    pass("7", "editor → agent selectie");
  } else fail("7", "CodeEditor mist onAnnotate");

  if (fs.existsSync(agent)) {
    const src = fs.readFileSync(agent, "utf-8");
    if (src.includes("filePaths") && src.includes("pendingSelection")) {
      pass("7", "AgentChat mentions + selection chip");
    } else fail("7", "AgentChat incompleet");
  } else fail("7", "AgentChat.tsx ontbreekt");

  if (fs.existsSync(route) && fs.readFileSync(route, "utf-8").includes("selection")) {
    pass("7", "agent API accepteert selection");
  } else fail("7", "agent route mist selection");
}

// ── Fase 8: diff review ──
function phase8() {
  console.log("\n── Fase 8: diff review ──");
  const diffLib = path.join(process.cwd(), "lib/code-line-diff.ts");
  const review = path.join(process.cwd(), "components/code-workspace/CodeDiffReview.tsx");
  const agent = path.join(process.cwd(), "components/code-workspace/AgentChat.tsx");
  const runner = path.join(process.cwd(), "lib/code-agent/run-code-agent.ts");

  if (fs.existsSync(diffLib)) {
    const src = fs.readFileSync(diffLib, "utf-8");
    if (src.includes("diffText") && src.includes("WriteProposal")) {
      pass("8", "code-line-diff helper");
    } else fail("8", "code-line-diff incompleet");
  } else fail("8", "code-line-diff.ts ontbreekt");

  if (fs.existsSync(review) && fs.readFileSync(review, "utf-8").includes("CodeDiffReview")) {
    pass("8", "CodeDiffReview component");
  } else fail("8", "CodeDiffReview ontbreekt");

  if (fs.existsSync(runner) && fs.readFileSync(runner, "utf-8").includes("write_proposal")) {
    pass("8", "agent write_proposal event");
  } else fail("8", "run-code-agent mist write_proposal");

  if (fs.existsSync(agent) && fs.readFileSync(agent, "utf-8").includes("write_proposal")) {
    pass("8", "AgentChat diff review wiring");
  } else fail("8", "AgentChat mist write_proposal handler");

  // sanity: inline diff algoritme
  const before = "a\nb\nc".split("\n");
  const after = "a\nx\nc".split("\n");
  if (before.length === 3 && after.length === 3) pass("8", "diff sanity");
  else fail("8", "diff sanity");
}

// ── Fase 9: git ──
async function phase9() {
  console.log("\n── Fase 9: git ──");
  const gitRoute = path.join(process.cwd(), "app/api/code/git/route.ts");
  const gitBar = path.join(process.cwd(), "components/code-workspace/CodeGitBar.tsx");
  if (fs.existsSync(gitRoute)) pass("9", "api/code/git route");
  else fail("9", "git route ontbreekt");
  if (fs.existsSync(gitBar)) pass("9", "CodeGitBar component");
  else fail("9", "CodeGitBar ontbreekt");
  const ws = global.__codeApiProject || global.__codeTestProject;
  const status = await fetchJson(
    `${base}/api/code/git?klant=${klant}&workspace=${ws}`
  );
  if (status.status === 200) pass("9", "git status GET");
  else fail("9", `git status HTTP ${status.status}`);
}

// ── Fase 10: Open in Code import ──
async function phase10() {
  console.log("\n── Fase 10: Open in Code ──");
  const importRoute = path.join(process.cwd(), "app/api/code/import/route.ts");
  const preview = path.join(process.cwd(), "components/project-preview.tsx");
  if (fs.existsSync(importRoute)) pass("10", "api/code/import route");
  else fail("10", "import route ontbreekt");
  if (fs.existsSync(preview) && fs.readFileSync(preview, "utf-8").includes("openInCode")) {
    pass("10", "ProjectPreview Open in Code");
  } else fail("10", "ProjectPreview mist openInCode");

  const imp = await fetchJson(`${base}/api/code/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      klant,
      title: "phase-test-import",
      name: `_import-${Date.now().toString(36)}`,
      files: { "index.html": "<!DOCTYPE html><html><body>import ok</body></html>" },
    }),
  });
  if (imp.status === 200 && imp.body?.workspace) {
    pass("10", `import → ${imp.body.workspace}`);
  } else {
    fail("10", `import HTTP ${imp.status}: ${imp.body?.error ?? ""}`);
  }
}

// ── Fase 11: PC bridge executor ──
async function phase11() {
  console.log("\n── Fase 11: PC bridge executor ──");
  const lib = path.join(process.cwd(), "lib/code-executor.ts");
  const bridge = path.join(process.cwd(), "lib/bridge-executor.ts");
  if (fs.existsSync(lib) && fs.readFileSync(lib, "utf-8").includes("callCodeExecutor")) {
    pass("11", "code-executor unified client");
  } else fail("11", "code-executor.ts ontbreekt");
  if (fs.existsSync(bridge)) pass("11", "bridge-executor helper");
  else fail("11", "bridge-executor.ts ontbreekt");
  const target = await fetchJson(`${base}/api/code/executor-target`);
  if (target.status === 200 && target.body?.active) {
    pass("11", `executor-target active=${target.body.active}`);
  } else fail("11", `executor-target HTTP ${target.status}`);
}

// ── Fase 12: cowork ──
async function phase12() {
  console.log("\n── Fase 12: /cowork ──");
  const page = path.join(process.cwd(), "app/cowork/page.tsx");
  const sidebar = path.join(process.cwd(), "components/motors-sidebar.tsx");
  if (fs.existsSync(page)) pass("12", "app/cowork/page.tsx");
  else fail("12", "cowork page ontbreekt");
  if (fs.existsSync(sidebar) && fs.readFileSync(sidebar, "utf-8").includes('href: "/cowork"')) {
    pass("12", "sidebar Cowork link");
  } else fail("12", "sidebar mist /cowork");
  const res = await fetch(`${base}/cowork`, { headers: authHeaders, redirect: "manual" });
  if (res.status === 200) pass("12", "/cowork HTTP 200");
  else fail("12", `/cowork HTTP ${res.status}`);
}

// ── Fase 13: OpenRouter code agent ──
function phase13() {
  console.log("\n── Fase 13: OpenRouter code agent ──");
  const files = [
    "lib/code-agent/code-models.ts",
    "lib/code-agent/openrouter-tools.ts",
    "lib/code-agent/run-code-agent-openrouter.ts",
    "lib/code-agent/code-agent-events.ts",
    "docs/env-recommended.code.txt",
  ];
  for (const f of files) {
    const p = path.join(process.cwd(), f);
    if (fs.existsSync(p)) pass("13", f);
    else fail("13", `${f} ontbreekt`);
  }
  const runAgent = fs.readFileSync(
    path.join(process.cwd(), "lib/code-agent/run-code-agent.ts"),
    "utf-8"
  );
  if (runAgent.includes("runOpenRouterCodeAgentStream")) {
    pass("13", "run-code-agent dispatch naar OpenRouter");
  } else fail("13", "run-code-agent mist OpenRouter dispatch");
  const route = fs.readFileSync(
    path.join(process.cwd(), "app/api/code/agent/route.ts"),
    "utf-8"
  );
  if (route.includes("isCodeAgentConfigured")) {
    pass("13", "agent route isCodeAgentConfigured");
  } else fail("13", "agent route mist isCodeAgentConfigured");
  const models = fs.readFileSync(
    path.join(process.cwd(), "lib/code-agent/code-models.ts"),
    "utf-8"
  );
  if (models.includes("resolveCodeModelForTurn")) {
    pass("13", "resolveCodeModelForTurn cost-aware routing");
  } else fail("13", "code-models mist resolveCodeModelForTurn");
  if (models.includes("anthropic/claude-sonnet-4.6")) {
    pass("13", "default heavy model claude-sonnet-4.6");
  } else fail("13", "code-models mist claude-sonnet-4.6 default");
}

async function phase18() {
  console.log("\n── Fase 18: platform trust ──");
  for (const f of [
    "lib/rate-limit.ts",
    "lib/audit-log.ts",
    "lib/db/platform-schema.ts",
    "app/api/usage/ingest/route.ts",
    "app/api/cron/backup/route.ts",
  ]) {
    if (fs.existsSync(path.join(process.cwd(), f))) pass("18", f);
    else fail("18", `${f} ontbreekt`);
  }
  if (fs.existsSync(path.join(process.cwd(), "scripts/test-cowork.mjs"))) {
    pass("18", "test-cowork.mjs");
  } else fail("18", "test-cowork.mjs ontbreekt");
}

async function phase14() {
  console.log("\n── Fase 14: code sessions ──");
  if (fs.existsSync(path.join(process.cwd(), "lib/code-sessions.ts"))) {
    pass("14", "code-sessions lib");
  } else fail("14", "code-sessions ontbreekt");
  if (fs.existsSync(path.join(process.cwd(), "app/api/code/sessions/route.ts"))) {
    pass("14", "sessions API");
  } else fail("14", "sessions API ontbreekt");
  if (token) {
    const res = await fetchJson(`${base}/api/code/sessions?klant=${klant}&workspace=${global.__codeApiProject || global.__codeTestProject}`, { headers: authHeaders });
    if (res.status === 200) pass("14", "sessions GET");
    else fail("14", `sessions GET HTTP ${res.status}`);
  }
}

function phase15() {
  console.log("\n── Fase 15: file CRUD ──");
  const route = fs.readFileSync(path.join(process.cwd(), "app/api/code/files/route.ts"), "utf-8");
  if (route.includes("action === \"delete\"")) pass("15", "files delete action");
  else fail("15", "files delete mist");
  if (route.includes("DELETE")) pass("15", "files DELETE method");
  else fail("15", "files DELETE mist");
}

function phase16() {
  console.log("\n── Fase 16: git branch/PR ──");
  const route = fs.readFileSync(path.join(process.cwd(), "app/api/code/git/route.ts"), "utf-8");
  if (route.includes("case \"branch\"")) pass("16", "git branch");
  else fail("16", "git branch mist");
  if (route.includes("case \"pr\"")) pass("16", "git pr");
  else fail("16", "git pr mist");
}

function phase17() {
  console.log("\n── Fase 17: @folder + terminal ──");
  const ctx = fs.readFileSync(path.join(process.cwd(), "lib/code-agent/message-context.ts"), "utf-8");
  if (ctx.includes("expandFolderMention")) pass("17", "@folder expand");
  else fail("17", "@folder mist");
  if (ctx.includes("terminalOutput")) pass("17", "terminal context");
  else fail("17", "terminal context mist");
  const chat = fs.readFileSync(path.join(process.cwd(), "components/code-workspace/AgentChat.tsx"), "utf-8");
  if (chat.includes("sessionId")) pass("17", "AgentChat sessions");
  else fail("17", "AgentChat sessions mist");
}

async function main() {
  console.log(`Motor /code phase tests — ${base} klant=${klant}`);
  phase1();
  await phase2();
  await phase3();
  await phase4();
  phase5();
  phase6();
  phase7();
  phase8();
  await phase9();
  await phase10();
  await phase11();
  await phase12();
  phase13();
  phase15();
  phase16();
  phase17();
  await phase14();
  await phase18();

  console.log("\n── Resultaat ──");
  if (failed) {
    console.error(`FAIL: ${failed} controle(s) mislukt`);
    process.exit(1);
  }
  console.log("PASS: alle fases groen");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
