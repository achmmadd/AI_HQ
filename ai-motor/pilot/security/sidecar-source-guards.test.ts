/**
 * sidecar-source-guards.test.ts — P0.6 spoor C, aanvalspunt 4.
 *
 * Statisch bewijs dat in de sidecar-sources nooit tool-, MCP- of
 * memory-activatie kan ontstaan zonder dat CI rood wordt. Complementair
 * aan de agentscope-guards in pilot/agentscope.test.ts (die het
 * opstartassert get_json_schemas en de telemetry-afwezigheid al dekken);
 * dit bestand dekt bredere patronen én de hermes-sidecar.
 *
 * Aanpak: docstrings/comments worden gestript vóór de verboden-patroon-
 * scan — een docstring die uitlegt dát agentscope.init nooit aangeroepen
 * wordt, is geen aanroep. Positieve verankering (het protocol bestaat uit
 * exact /health, /invoke, /cancel) draait op de gestripte bron.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const AGENTSCOPE_SIDECAR_URL = new URL(
  "../adapters/agentscope/sidecar.py",
  import.meta.url,
);
const HERMES_SIDECAR_URL = new URL(
  "../../infra/pilot/hermes/sidecar.py",
  import.meta.url,
);

/** Verwijder Python-docstrings en #-commentaar zodat alleen code overblijft. */
function stripPythonNarrative(raw: string): string {
  return raw
    .replace(/"""[\s\S]*?"""/g, '""')
    .replace(/'''[\s\S]*?'''/g, "''")
    .split("\n")
    .map((line) => {
      let inSingle = false;
      let inDouble = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === "'" && !inDouble) inSingle = !inSingle;
        else if (ch === '"' && !inSingle) inDouble = !inDouble;
        else if (ch === "#" && !inSingle && !inDouble) return line.slice(0, i);
      }
      return line;
    })
    .join("\n");
}

/**
 * Tool-/framework-activeringspatronen die in geen enkele sidecar mogen
 * voorkomen. bewust breed: niet alleen de bekende agentscope-/MCP-vormen
 * maar ook generieke registratie-, shell- en memory-haken.
 */
const FORBIDDEN_PATTERNS: readonly { readonly name: string; readonly re: RegExp }[] = [
  { name: "toolregistratie (register_tool*)", re: /register_tool|register_agent|toolkit\.add|Toolkit\s*\(\s*[^)]+/ },
  { name: "MCP-client import", re: /(^|\s)(import|from)\s+mcp(\s|\.|$)/m },
  { name: "agentscope.init (telemetry/studio)", re: /agentscope\.init\s*\(/ },
  { name: "memory-activering", re: /from\s+agentscope\s*\.\s*memory|import\s+.*\bmemory\b|Memory\s*\(/ },
  { name: "ReAct/agent-constructie", re: /ReActAgent|AgentBase\s*\(|UserAgent/ },
  { name: "shell/proces-executie", re: /subprocess|os\.system|pty\.|pexpect/ },
  { name: "dynamische code-executie", re: /(?<![\w.])eval\s*\(|(?<![\w.])exec\s*\(|__import__|importlib/ },
  { name: "netwerk-server buiten de sidecar-handler", re: /socket\.|asyncio\.start_server|websocket/i },
];

for (const [label, url] of [
  ["agentscope", AGENTSCOPE_SIDECAR_URL],
  ["hermes", HERMES_SIDECAR_URL],
] as const) {
  test(`S4. ${label}-sidecar: geen tool/MCP/memory-activering in de code`, async () => {
    const raw = await readFile(url, "utf8");
    const code = stripPythonNarrative(raw);
    for (const { name, re } of FORBIDDEN_PATTERNS) {
      assert.ok(!re.test(code), `${label}: verboden patroon aanwezig — ${name}`);
    }
    // De sidecar spreekt exact het fase-0-protocol en niets anders.
    for (const route of ['"/health"', '"/invoke"', '"/cancel"']) {
      assert.ok(code.includes(route), `${label}: protocolroute ${route} ontbreekt`);
    }
    // Geen enkele andere route mag beantwoord worden: een extra pad zou
    // als literal in do_GET/do_POST zichtbaar moeten zijn.
    const routeLiterals = code.match(/self\.path\s*==\s*"[^"]+"/g) ?? [];
    assert.deepEqual(
      routeLiterals.sort(),
      [
        'self.path == "/cancel"',
        'self.path == "/health"',
        'self.path == "/invoke"',
      ],
      `${label}: onbekende HTTP-routes in de handler`,
    );
  });
}

test("S4. agentscope-sidecar: de Toolkit wordt aangemaakt, leeg geassert en nooit doorgegeven", async () => {
  const code = stripPythonNarrative(await readFile(AGENTSCOPE_SIDECAR_URL, "utf8"));
  assert.ok(code.includes("Toolkit()"), "de Toolkit-constructie bestaat (leeg)");
  assert.ok(
    code.includes("get_json_schemas"),
    "de startup-assertie op nul tools bestaat",
  );
  // De toolkit verlaat main() nooit richting het model: build_model en
  // generate nemen geen toolkit-parameter.
  assert.ok(
    !/def\s+build_model\s*\([^)]*toolkit/i.test(code),
    "build_model krijgt geen toolkit",
  );
  assert.ok(
    !/def\s+generate\s*\([^)]*toolkit/i.test(code),
    "generate krijgt geen toolkit",
  );
});

test("S4. hermes-sidecar: puur stdlib, geen runtime-import, invoke faalt eerlijk 501", async () => {
  const code = stripPythonNarrative(await readFile(HERMES_SIDECAR_URL, "utf8"));
  // De skeleton-status is een security-eigenschap: zolang Hermes niet
  // bedraad is, mag /invoke nooit een gefabuleerd resultaat teruggeven.
  assert.ok(
    code.includes("NotImplementedError"),
    "invoke_hermes blijft bewust onbedraad",
  );
  assert.ok(code.includes("501"), "het eerlijke 501-antwoord blijft aanwezig");
  const imports = [...code.matchAll(/^(?:import|from)\s+([a-zA-Z0-9_.]+)/gm)].map(
    (m) => m[1],
  );
  for (const mod of imports) {
    assert.ok(
      ["json", "os", "threading", "http.server", "__future__"].includes(mod),
      `hermes-sidecar importeert alleen stdlib, niet: ${mod}`,
    );
  }
});
