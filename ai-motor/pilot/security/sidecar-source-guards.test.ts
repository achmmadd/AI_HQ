/**
 * sidecar-source-guards.test.ts — P0.6 spoor C, aanvalspunt 4.
 *
 * Statisch bewijs dat in de sidecar-sources nooit tool-, MCP- of
 * memory-activatie kan ontstaan zonder dat CI rood wordt. Complementair
 * aan de agentscope-guards in pilot/agentscope.test.ts; dit bestand dekt
 * bredere patronen én de hermes-sidecar.
 *
 * Reconciliatie P0.6 spoor F: beide sidecars zijn inmiddels BEWUST bedraad
 * (spoor A/B) — deze guards dwingen de eigenschappen van die bedraade
 * runtime af, niet het oude 501-skeleton:
 *
 * - geen toolregistratie, geen agentscope.init, geen memory-backend,
 *   geen MCP-import, geen subprocess/os.system, geen dynamische code;
 * - geen bestandsschrijfacties (de sidecar is stateless; wfile/stderr
 *   zijn HTTP-/logstreams, geen bestanden);
 * - geen ruwe-socket-creatie of eigen netwerkserver: de enige legitieme
 *   socket-aanraking is shutdown()/close() van de live modelverbinding
 *   bij /cancel (hermes) — positief verankerd in de hermes-guard;
 * - env-lees uitsluitend uit een expliciete niet-geheime allowlist en
 *   nooit in bulk (geen os.environ.items()/dict(os.environ)/iteratie);
 * - netwerkverkeer uitsluitend naar het geconfigureerde modelendpoint:
 *   geen hardgecodeerde externe URL's en een aantoonbaar enkele
 *   egress-route (choke point) per sidecar.
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

/** Vervang stringliteralen door lege strings — voor identifier-scans. */
function stripStringLiterals(code: string): string {
  return code
    .replace(/\bf"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, "''");
}

/**
 * Tool-/framework-activeringspatronen die in geen enkele sidecar mogen
 * voorkomen. Bewust breed: niet alleen de bekende agentscope-/MCP-vormen
 * maar ook generieke registratie-, shell-, memory- en schrijfhaken.
 */
const FORBIDDEN_PATTERNS: readonly { readonly name: string; readonly re: RegExp }[] = [
  { name: "toolregistratie (register_tool*)", re: /register_tool|register_agent|toolkit\.add|Toolkit\s*\(\s*[^)]+/ },
  { name: "MCP-client import", re: /(^|\s)(import|from)\s+mcp(\s|\.|$)/m },
  { name: "agentscope.init (telemetry/studio)", re: /agentscope\.init\s*\(/ },
  { name: "memory-activering", re: /from\s+agentscope\s*\.\s*memory|import\s+.*\bmemory\b|Memory\s*\(/ },
  { name: "ReAct/agent-constructie", re: /ReActAgent|AgentBase\s*\(|UserAgent/ },
  { name: "shell/proces-executie", re: /subprocess|os\.system|pty\.|pexpect/ },
  { name: "dynamische code-executie", re: /(?<![\w.])eval\s*\(|(?<![\w.])exec\s*\(|__import__|importlib/ },
  {
    // Een sidecar opent nooit zelf een socket of server; de HTTP-server is
    // stdlib http.server en egress loopt via http.client/urllib naar het
    // geconfigureerde modelendpoint. socket.shutdown() op de live
    // modelverbinding (cancel) is legitiem en apart positief verankerd.
    name: "ruwe socket- of server-creatie",
    re: /socket\.socket\s*\(|socket\.create_connection|socket\.create_server|asyncio\.start_server|websocket|\.bind\s*\(|\.listen\s*\(/i,
  },
  {
    // Stateless proces: geen bestandsschrijverij. wfile.write/stderr.write
    // zijn streams en matchen deze patronen niet.
    name: "bestandsschrijfacties",
    re: /(?<![\w.])open\s*\(|pathlib|write_text|write_bytes|shutil\.|tempfile|pickle|os\.(makedirs|mkdir|remove|unlink|rmdir|rename|replace|chmod|chown)\b/,
  },
  {
    // Config komt sleutel-voor-sleutel uit de allowlist; bulk-lezen van de
    // omgeving (exfiltratie-vector) is verboden.
    name: "bulk env-lees",
    re: /os\.environ\.(items|keys|values|copy)\s*\(|dict\(\s*os\.environ|for\s+[^\n]*\bin\s+os\.environ\b/,
  },
];

interface EnvReads {
  readonly keys: readonly string[];
  readonly unresolved: readonly string[];
}

/**
 * Verzamel alle omgevingslezingen: os.environ.get(...), os.getenv(...),
 * os.environ[...] én source.get(...) (load_config's alias van os.environ).
 * ENV_*-constanten worden naar hun definitie opgelost; alles dat niet
 * statisch oplosbaar is, is een schending op zichzelf (fail-closed).
 */
function envReadsOf(code: string): EnvReads {
  const consts = new Map<string, string>();
  for (const m of code.matchAll(/^(ENV_\w+)\s*=\s*"([A-Z0-9_]+)"\s*$/gm)) {
    consts.set(m[1], m[2]);
  }
  const keys: string[] = [];
  const unresolved: string[] = [];
  const reads = [
    ...code.matchAll(/(?:os\.environ|source|os\.getenv)\s*(?:\.get)?\(\s*([^,)]+)/g),
    ...code.matchAll(/os\.environ\[\s*([^\]]+)\]/g),
  ];
  for (const m of reads) {
    const arg = m[1].trim().replace(/['"]/g, "");
    const resolved = consts.get(arg);
    if (resolved !== undefined) keys.push(resolved);
    else if (/^[A-Z0-9_]+$/.test(arg)) keys.push(arg);
    else unresolved.push(arg);
  }
  return { keys, unresolved };
}

/** Iedere gelezen env-sleutel moet expliciet niet-geheime config zijn. */
function assertEnvReadsAllowlisted(
  code: string,
  allowlist: readonly string[],
  label: string,
): void {
  const { keys, unresolved } = envReadsOf(code);
  assert.deepEqual(
    unresolved,
    [],
    `${label}: env-lees niet statisch oplosbaar — maak de sleutel expliciet`,
  );
  for (const key of keys) {
    assert.ok(
      allowlist.includes(key),
      `${label}: env-sleutel buiten de niet-geheime allowlist: ${key}`,
    );
  }
}

/**
 * Geen hardgecodeerde netwerk-URL's in de code: egress mag alleen naar het
 * geconfigureerde modelendpoint lopen, nooit naar een ingebakken host. Alleen
 * de gedocumenteerde loopback-default en de eigen bind-printf zijn toegestaan.
 */
function assertNoHardcodedEgress(
  code: string,
  allowedLiterals: readonly RegExp[],
  label: string,
): void {
  for (const m of code.matchAll(/https?:\/\/[^\s"'`)\]]+/g)) {
    const literal = m[0];
    assert.ok(
      allowedLiterals.some((re) => re.test(literal)),
      `${label}: hardgecodeerde netwerk-URL ${literal} — egress loopt uitsluitend naar het geconfigureerde modelendpoint`,
    );
  }
}

interface SidecarSpec {
  readonly url: URL;
  readonly envAllowlist: readonly string[];
  readonly allowedUrlLiterals: readonly RegExp[];
}

const SIDECARS: Record<string, SidecarSpec> = {
  agentscope: {
    url: AGENTSCOPE_SIDECAR_URL,
    envAllowlist: [
      "AGENTSCOPE_SIDECAR_HOST",
      "AGENTSCOPE_SIDECAR_PORT",
      "MODEL_NAME",
      "MODEL_PORT_URL",
      "MODEL_TIMEOUT_MS",
    ],
    // De gedocumenteerde loopback-default van MODEL_PORT_URL; verder niets.
    allowedUrlLiterals: [/^https?:\/\/127\.0\.0\.1(?::|\/)/],
  },
  hermes: {
    url: HERMES_SIDECAR_URL,
    envAllowlist: [
      "HERMES_SIDECAR_HOST",
      "HERMES_SIDECAR_PORT",
      "MODEL_NAME",
      "MODEL_PORT_URL",
      "MODEL_REQUEST_TIMEOUT_S",
    ],
    // Geen URL-defaults; het enige literal is de eigen bind-printf.
    allowedUrlLiterals: [/^http:\/\/\{host\}/],
  },
};

for (const [label, spec] of Object.entries(SIDECARS)) {
  test(`S4. ${label}-sidecar: geen tool/MCP/memory-activering, geen env- of egress-ontsnapping`, async () => {
    const raw = await readFile(spec.url, "utf8");
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
    assertEnvReadsAllowlisted(code, spec.envAllowlist, label);
    assertNoHardcodedEgress(code, spec.allowedUrlLiterals, label);
  });
}

test("S4. agentscope-sidecar: de lege Toolkit verlaat de startup-assertie nooit; modelbinding alleen naar MODEL_PORT_URL", async () => {
  const code = stripPythonNarrative(await readFile(AGENTSCOPE_SIDECAR_URL, "utf8"));
  assert.ok(code.includes("Toolkit()"), "de Toolkit-constructie bestaat (leeg)");
  // De startup-assertie in agentscope-2.0.6-vorm: het async
  // get_tool_schemas() vervangt het oude get_json_schemas; het proces
  // weigert te starten zodra er ooit een tool/schema verschijnt.
  assert.ok(
    /await\s+toolkit\.get_tool_schemas\(\)[\s\S]*?if\s+schemas\s*:\s*\n\s*raise\s+RuntimeError/.test(
      code,
    ),
    "de startup-assertie op nul tools bestaat en faalt hard bij elke tool",
  );
  assert.ok(
    code.includes("RUNTIME.run_blocking(assert_empty_toolkit()"),
    "main() voert de lege-toolkit-assertie echt uit bij opstarten",
  );
  // De toolkit verlaat de assertiefunctie nooit richting het model:
  // build_model en _generate kennen geen toolkit-parameter en nergens
  // buiten de assertiefunctie bestaat een toolkit-referentie.
  assert.ok(
    !/def\s+build_model\s*\([^)]*toolkit/i.test(code),
    "build_model krijgt geen toolkit",
  );
  assert.ok(
    !/def\s+_?generate\s*\([^)]*toolkit/i.test(code),
    "generate krijgt geen toolkit",
  );
  const identifiers = stripStringLiterals(code);
  const fnStart = identifiers.indexOf("async def assert_empty_toolkit");
  assert.ok(fnStart >= 0, "de toolkit-assertiefunctie bestaat");
  const rest = identifiers.slice(fnStart + 1).search(/\n(?:async\s+def|def|class)\s/);
  const fnEnd = rest === -1 ? identifiers.length : fnStart + 1 + rest;
  for (const m of identifiers.matchAll(/\btoolkit\b/g)) {
    const idx = m.index ?? -1;
    assert.ok(
      idx >= fnStart && idx < fnEnd,
      `toolkit-referentie buiten de assertiefunctie (offset ${idx})`,
    );
  }
  // Eigenschap van de bedraade runtime: het model is exclusief aan het
  // ModelPort gebonden en de enige directe HTTP-probe peilt
  // {MODEL_PORT_URL}/models — nergens anders heen.
  assert.ok(
    code.includes("base_url=MODEL_PORT_URL"),
    "de modelclient kent uitsluitend het geconfigureerde ModelPort als base_url",
  );
  assert.equal(
    code.match(/urllib\.request\.urlopen\s*\(/g)?.length ?? 0,
    1,
    "precies één directe HTTP-probe (de readiness-peiling)",
  );
  assert.equal(
    code.match(/urllib\.request\.Request\s*\(/g)?.length ?? 0,
    1,
    "precies één probe-request",
  );
  assert.ok(
    code.includes('MODEL_PORT_URL.rstrip("/") + "/models"'),
    "de readiness-probe peilt uitsluitend het geconfigureerde modelendpoint",
  );
});

test("S4. hermes-sidecar: puur stdlib; invoke is echt bedraad naar uitsluitend het geconfigureerde modelendpoint", async () => {
  const code = stripPythonNarrative(await readFile(HERMES_SIDECAR_URL, "utf8"));

  // Puur stdlib: er bestaat geen extern "Hermes"-package — dit proces IS de
  // Motor-Hermes-runtime. Iedere import buiten deze stdlib-allowlist is een
  // bewuste, reviewbare wijziging en laat deze guard rood worden.
  const imports = [...code.matchAll(/^(?:import|from)\s+([a-zA-Z0-9_.]+)/gm)].map(
    (m) => m[1],
  );
  for (const mod of imports) {
    assert.ok(
      [
        "__future__",
        "http.client",
        "http.server",
        "json",
        "os",
        "socket",
        "threading",
        "urllib.parse",
      ].includes(mod),
      `hermes-sidecar importeert alleen stdlib, niet: ${mod}`,
    );
  }

  // /invoke voert werkelijk uit: het succesantwoord is gebonden aan de
  // echte modelcall — de sidecar verzint nooit zelf een output.
  assert.ok(
    code.includes("output = call_model(config, attempt, prompt)"),
    "/invoke bindt de output aan de echte modelcall",
  );
  assert.ok(
    /_send_json\(\s*200,\s*\{\s*"output": output, \*\*echo \}\)/.test(code),
    "het enige 200-succesantwoord draagt de modeloutput en de causale echo",
  );
  // Eerlijke fasen-0-fouttaxonomie in plaats van een gefabuleerd resultaat.
  for (const status of ["422", "503", "504"]) {
    assert.ok(
      code.includes(`_send_json(${status}`),
      `de eerlijke ${status}-foutmapping blijft aanwezig`,
    );
  }

  // /cancel onderbreekt de in-flight modelverbinding: shutdown() + close()
  // op de live socket is de ENIGE legitieme socket-aanraking in dit bestand.
  assert.ok(
    code.includes("sock.shutdown(socket.SHUT_RDWR)"),
    "/cancel breekt de geblokkeerde modelread via socket-shutdown",
  );
  assert.ok(
    code.includes("conn.close()"),
    "/cancel sluit de live modelverbinding",
  );

  // Egress-chokepoint: HTTPConnection/HTTPSConnection worden uitsluitend
  // binnen _open_connection geconstrueerd, en _open_connection wordt
  // uitsluitend gevoed met URL's die uit MODEL_PORT_URL afleidbaar zijn.
  const connCtors = code.match(/http\.client\.HTTPS?Connection\s*\(/g) ?? [];
  assert.equal(
    connCtors.length,
    2,
    "HTTP(S)Connection wordt op exact twee plekken geconstrueerd (http+https in _open_connection)",
  );
  const fnStart = code.indexOf("def _open_connection");
  assert.ok(fnStart >= 0, "de egress-chokepoint _open_connection bestaat");
  const rest = code.slice(fnStart + 1).search(/\ndef /);
  const fnEnd = rest === -1 ? code.length : fnStart + 1 + rest;
  for (const m of code.matchAll(/http\.client\.HTTPS?Connection\s*\(/g)) {
    const idx = m.index ?? -1;
    assert.ok(
      idx >= fnStart && idx < fnEnd,
      "HTTP(S)Connection-constructie buiten _open_connection",
    );
  }
  const egressCalls = [
    ...code.matchAll(/(?<!def )_open_connection\(\s*([\w.]+)/g),
  ].map((m) => m[1]);
  assert.deepEqual(
    egressCalls.sort(),
    ["config.models_url", "url"],
    "egress gaat alleen naar de health- en chat-completions-URL van de config",
  );
  assert.ok(
    /^\s+url = config\.chat_completions_url$/m.test(code),
    "de lokale egress-URL in call_model is bewezen de chat-completions-URL van de config",
  );
  assert.ok(
    code.includes('return f"{self.model_port_url}/chat/completions"') &&
      code.includes('return f"{self.model_port_url}/models"'),
    "beide egress-URL's zijn afgeleid van de geconfigureerde MODEL_PORT_URL",
  );
});
