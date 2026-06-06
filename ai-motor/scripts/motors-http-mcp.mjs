#!/usr/bin/env node
/**
 * Stdio MCP server: exposes MotorsAI HTTP tools from motors-tools.json for OpenClaw.
 * Auth: MOTORS_INTERNAL_TOKEN (ai-motor) and LOCAL_EXECUTOR_SECRET (executor).
 */
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveMcpSdkRoot() {
  const candidates = [
    process.env.MCP_SDK_PATH,
    resolve(
      process.env.HOME || "/home/pietje",
      ".nvm/versions/node/v22.22.2/lib/node_modules/openclaw/node_modules/@modelcontextprotocol/sdk"
    ),
  ].filter(Boolean);
  for (const root of candidates) {
    if (existsSync(resolve(root, "package.json"))) return root;
  }
  throw new Error(
    "MCP SDK not found — set MCP_SDK_PATH or install openclaw (Node 22+)"
  );
}

const require = createRequire(import.meta.url);
const sdkRoot = resolveMcpSdkRoot();
const { Server } = require(resolve(sdkRoot, "server/index.js"));
const { StdioServerTransport } = require(resolve(sdkRoot, "server/stdio.js"));
const {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} = require(resolve(sdkRoot, "types.js"));

function loadManifest() {
  const path =
    process.env.MOTORS_TOOLS_JSON?.trim() ||
    resolve(process.env.HOME || "/home/pietje", ".openclaw/motors-tools.json");
  if (!existsSync(path)) {
    throw new Error(`motors-tools.json not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

function bodyToInputSchema(body) {
  if (!body || typeof body !== "object") {
    return { type: "object", properties: {}, additionalProperties: true };
  }
  const properties = {};
  const required = [];
  for (const [key, val] of Object.entries(body)) {
    const desc = String(val);
    if (desc.includes("|")) {
      properties[key] = { type: "string", description: desc };
    } else if (desc === "number") {
      properties[key] = { type: "number", description: key };
    } else {
      properties[key] = { type: "string", description: desc };
    }
    if (
      desc.includes("required") ||
      key === "content" ||
      key === "query" ||
      key === "prompt"
    ) {
      required.push(key);
    }
  }
  return {
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
    additionalProperties: true,
  };
}

function resolveUrl(baseUrl, tool) {
  if (tool.path.startsWith("http://") || tool.path.startsWith("https://")) {
    return tool.path;
  }
  return `${baseUrl.replace(/\/$/, "")}${tool.path}`;
}

function authHeaderForTool(tool) {
  if (tool.name === "motors_executor") {
    const secret = process.env.LOCAL_EXECUTOR_SECRET?.trim();
    return secret ? { Authorization: `Bearer ${secret}` } : {};
  }
  const token = process.env.MOTORS_INTERNAL_TOKEN?.trim();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function invokeTool(manifest, tool, args) {
  const url = resolveUrl(manifest.base_url || "http://127.0.0.1:3040", tool);
  const method = (tool.method || "POST").toUpperCase();
  const headers = {
    "Content-Type": "application/json",
    ...authHeaderForTool(tool),
  };
  const init = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    init.body = JSON.stringify(args ?? {});
  }
  const res = await fetch(url, init);
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `HTTP ${res.status}: ${typeof parsed === "object" ? JSON.stringify(parsed) : text}`
    );
  }
  return parsed;
}

async function main() {
  const manifest = loadManifest();
  const tools = (manifest.tools || []).filter((t) => t.name && t.path);

  const server = new Server(
    { name: "motors-http", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description || t.name,
      inputSchema: bodyToInputSchema(t.body),
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const tool = tools.find((t) => t.name === name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }
    try {
      const result = await invokeTool(manifest, tool, request.params.arguments);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text", text: msg }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("[motors-http-mcp]", err);
  process.exit(1);
});
