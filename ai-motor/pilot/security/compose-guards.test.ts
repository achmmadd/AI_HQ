/**
 * compose-guards.test.ts — P0.6 spoor C, aanvalspunt 3.
 *
 * Bewijs dat de sidecar-compose-overlays (hermes, agentscope) en de basis
 * pilot-compose nooit context-/draft-/host-volumes in een sidecar mounten
 * en nooit secrets in een sidecar-omgeving zetten.
 *
 * Methode (les uit spoor A): commentaar wordt eerst gestript — een comment
 * dat een verboden mount of secret BENOEMT is geen mount — en services
 * worden geankerd op regelbegin ("  motor-pilot-store:" vs. een dieper
 * ingesprongen depends_on-verwijzing). Alle assertions draaien op de
 * effectieve (comment-loze) YAML-tekst; geen docker nodig.
 *
 * Complementair aan boundary-test 7g (mountmatrix basiscompose) en de
 * agentscope-overlay-guard in pilot/agentscope.test.ts.
 *
 * P0.8 (compose-integratie): elke sidecar krijgt een tweede attachment aan
 * het dedicated egress-netwerk pilot-egress (voor het tailnet-ModelPort).
 * De eis wordt daarmee VERSCHERPT, niet verbreed: de toegestane netwerkset
 * is gesloten ({eiland, pilot-egress}), het eiland blijft verplicht én
 * internal: true, pilot-egress mag nooit internal zijn (dat zou egress
 * blokkeren) en nooit aan een andere dienst hangen, en nergens in een
 * overlay mag een expliciete `internal: false` staan.
 */

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

/** Strip #-commentaar buiten quotes; behoudt regelstructuur en inspringing. */
function stripComments(raw: string): string {
  return raw
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
 * Eén blok op vaste inspringdiepte, geankerd op regelbegin. Bijvoorbeeld
 * serviceBlock(compose, "hermes-sidecar") geeft exact de sectie
 * "  hermes-sidecar:" tot de volgende service op twee spaties.
 */
function anchoredBlock(raw: string, indent: number, name: string): string {
  const pad = " ".repeat(indent);
  const start = raw.search(new RegExp(`^${pad}${name}:\\n`, "m"));
  assert.ok(start >= 0, `blok ${name} (indent ${indent}) ontbreekt`);
  const rest = raw.slice(start + pad.length + name.length + 2);
  // Blokeinde: elke niet-lege regel met hooguit `indent` spaties — zo loopt
  // een serviceblok nooit door in een volgende service of top-level sleutel.
  const next = rest.search(new RegExp(`^ {0,${indent}}\\S`, "m"));
  return next === -1 ? rest : rest.slice(0, next);
}

/** Sleutels van een environment:-sectie binnen een serviceblok. */
function envKeysOf(serviceBlock: string): string[] {
  const match = serviceBlock.match(/^    environment:\n((?:      .*\n?)+)/m);
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((line) => /^      ([A-Za-z0-9_]+):/.exec(line)?.[1])
    .filter((key): key is string => key !== undefined);
}

/** Volume-entries ("- links:rechts[:flags]") binnen een serviceblok. */
function volumeEntriesOf(serviceBlock: string): string[] {
  const match = serviceBlock.match(/^    volumes:\n((?:      .*\n?)+)/m);
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((line) => /^\s+- (.*)$/.exec(line)?.[1]?.trim())
    .filter((entry): entry is string => entry !== undefined && entry !== "");
}

/** Netwerk-entries ("- naam") binnen een serviceblok. */
function networkEntriesOf(serviceBlock: string): string[] {
  const match = serviceBlock.match(/^    networks:\n((?:      .*\n?)+)/m);
  if (!match) return [];
  return match[1]
    .split("\n")
    .map((line) => /^\s+- ([\w.-]+)\s*$/.exec(line)?.[1])
    .filter((entry): entry is string => entry !== undefined);
}

const BASE_URL = new URL("../../infra/pilot/compose.yaml", import.meta.url);
const HERMES_URL = new URL("../../infra/pilot/compose.hermes.yaml", import.meta.url);
const AGENTSCOPE_URL = new URL("../../infra/pilot/compose.agentscope.yaml", import.meta.url);

/** Alles wat een sidecar nooit mag zien: volumenamen, paden en secret-keys. */
const FORBIDDEN_VOLUME_TOKENS = [
  "pilot-context",
  "pilot-drafts",
  "/data",
  "/context",
  "docker.sock",
  "tailscaled.sock",
] as const;

const FORBIDDEN_ENV_PATTERN = /SECRET|TOKEN|PASSWORD|API[-_]?KEY|CREDENTIAL/i;

/**
 * P0.8 netwerk-invariant per sidecar: exact het eigen eiland plus hooguit
 * pilot-egress. De set is gesloten — ieder ander netwerk is een overtreding.
 */
function assertSidecarNetworks(
  serviceBlock: string,
  island: string,
  label: string,
): void {
  const nets = networkEntriesOf(serviceBlock);
  assert.ok(nets.includes(island), `${label}: eiland ${island} ontbreekt`);
  for (const net of nets) {
    assert.ok(
      net === island || net === "pilot-egress",
      `${label}: onverwacht netwerk ${net} (toegestaan: ${island}, pilot-egress)`,
    );
  }
  assert.equal(
    new Set(nets).size,
    nets.length,
    `${label}: dubbele netwerk-attachment`,
  );
}

/**
 * P0.8 egress-invariant op bestandsniveau: het eiland is én blijft
 * internal: true; pilot-egress bestaat, is bewust NIET internal en hangt
 * aan precies één dienst (de sidecar); `internal: false` komt nergens voor.
 */
function assertEgressDesign(
  compose: string,
  island: string,
  label: string,
): void {
  const islandBlock = anchoredBlock(compose, 2, island);
  assert.ok(
    /internal:\s*true/.test(islandBlock),
    `${label}: eiland ${island} moet internal: true zijn (en blijven)`,
  );
  const egressBlock = anchoredBlock(compose, 2, "pilot-egress");
  assert.ok(
    !/internal:\s*true/.test(egressBlock),
    `${label}: pilot-egress met internal: true zou egress blokkeren`,
  );
  assert.ok(
    !/internal:\s*false/.test(compose),
    `${label}: expliciete internal: false hoort nergens in een overlay`,
  );
  const attachments = compose.match(/^ {6}- pilot-egress\s*$/gm) ?? [];
  assert.equal(
    attachments.length,
    1,
    `${label}: pilot-egress mag alleen aan de sidecar hangen (1 attachment)`,
  );
}

function assertSidecarIsolation(
  serviceBlock: string,
  label: string,
  options: { readonly allowPorts: boolean },
): void {
  // Fysieke isolatie: geen context/draft/host-volumes, geen sockets.
  for (const token of FORBIDDEN_VOLUME_TOKENS) {
    assert.ok(!serviceBlock.includes(token), `${label}: verboden token ${token}`);
  }
  // Iedere mount is read-only en nooit een absoluut hostpad.
  for (const entry of volumeEntriesOf(serviceBlock)) {
    assert.ok(entry.endsWith(":ro"), `${label}: mount niet read-only: ${entry}`);
    assert.ok(
      !entry.split(":")[0].startsWith("/"),
      `${label}: absoluut hostpad als mount-bron: ${entry}`,
    );
  }
  // Geen secrets in de omgeving.
  for (const key of envKeysOf(serviceBlock)) {
    assert.ok(!FORBIDDEN_ENV_PATTERN.test(key), `${label}: secret-achtige env-key ${key}`);
  }
  // Netwerk- en privilegebasis. Poorten zijn per-overlay beleid: hermes
  // publiceert niets, agentscope publiceert exact één loopback-mapping
  // (apart geassert in S3b).
  assert.ok(!serviceBlock.includes("network_mode: host"), `${label}: host-netwerk`);
  if (!options.allowPorts) {
    assert.ok(!/^    ports:/m.test(serviceBlock), `${label}: gepubliceerde poorten`);
  }
  assert.ok(serviceBlock.includes("read_only: true"), `${label}: read_only ontbreekt`);
  assert.ok(serviceBlock.includes("cap_drop"), `${label}: cap_drop ontbreekt`);
  assert.ok(serviceBlock.includes("ALL"), `${label}: cap_drop ALL ontbreekt`);
  assert.ok(serviceBlock.includes("no-new-privileges"), `${label}: no-new-privileges ontbreekt`);
  assert.ok(!/user:\s*"0"/.test(serviceBlock), `${label}: draait als root`);
}

test("S3a. hermes-overlay: geen volumes/secrets, intern netwerk, loopback-discipline", async () => {
  const compose = stripComments(await readFile(HERMES_URL, "utf8"));

  const sidecar = anchoredBlock(compose, 2, "hermes-sidecar");
  assertSidecarIsolation(sidecar, "hermes-sidecar", { allowPorts: false });

  // De bedraade sidecar mount NIETS: het image (build uit
  // infra/pilot/hermes, gepinde base-digest) draagt zelf de enige code.
  // Geen repo-, context-, draft- of host-mount en geen duurzame staat.
  assert.ok(!/^    volumes:/m.test(sidecar), "hermes-sidecar heeft geen volumes-sectie");
  assert.deepEqual(volumeEntriesOf(sidecar), [], "hermes-sidecar mount niets");

  // Expliciet non-root: een bekende numerieke uid, nooit 0.
  const user = /user:\s*"(\d+):\d+"/.exec(sidecar);
  assert.ok(user !== null, "hermes-sidecar zet een expliciete numerieke non-root user");
  assert.notEqual(user[1], "0", "hermes-sidecar draait nooit als uid 0");

  // P0.8-verbreding van de oude exclusiviteitsassert (was: exact
  // ["hermes-net"]). Tóen had de sidecar geen enkele egress; nu krijgt hij
  // precies één dedicated egress-attachment voor het tailnet-ModelPort.
  // De isolatie-eis is verscherpt tot een gesloten set: hermes-net blijft
  // verplicht én internal, pilot-egress is de enige toegestane toevoeging,
  // en ieder ander netwerk faalt hier.
  assertSidecarNetworks(sidecar, "hermes-net", "hermes-sidecar");

  // Omgeving: uitsluitend bekende niet-geheime config. De modelendpoint
  // (MODEL_PORT_URL) is configuratie, geen credential — iedere nieuwe key
  // is een bewuste, reviewbare wijziging.
  assert.deepEqual(envKeysOf(sidecar).sort(), [
    "HERMES_SIDECAR_HOST",
    "HERMES_SIDECAR_PORT",
    "MODEL_NAME",
    "MODEL_PORT_URL",
    "MODEL_REQUEST_TIMEOUT_S",
  ]);

  // Het eiland is én blijft echt intern (geen egress, geen route naar de
  // storepoort of host-loopback van andere diensten); pilot-egress is de
  // enige, bewust niet-internal opening en hangt alleen aan de sidecar.
  assertEgressDesign(compose, "hermes-net", "hermes-overlay");

  // De overlay declareert zelf geen enkel volume.
  assert.ok(!/^volumes:/m.test(compose), "overlay definieert geen volumes");
});

test("S3b. agentscope-overlay: geen volumes/secrets; enige poort is host-loopback", async () => {
  const raw = await readFile(AGENTSCOPE_URL, "utf8");
  const compose = stripComments(raw);

  const sidecar = anchoredBlock(compose, 2, "agentscope-sidecar");
  assertSidecarIsolation(sidecar, "agentscope-sidecar", { allowPorts: true });
  // Helemaal geen volumes-sectie in de service: stateless, geen data.
  assert.ok(!/^    volumes:/m.test(sidecar), "agentscope-sidecar mount niets");
  // Exact de verwachte env-keys; OTEL uit, geen enkel credential.
  assert.deepEqual(envKeysOf(sidecar).sort(), [
    "AGENTSCOPE_SIDECAR_HOST",
    "AGENTSCOPE_SIDECAR_PORT",
    "MODEL_NAME",
    "MODEL_PORT_URL",
    "MODEL_TIMEOUT_MS",
    "OTEL_SDK_DISABLED",
    "PYTHONDONTWRITEBYTECODE",
    "PYTHONUNBUFFERED",
  ]);
  assert.ok(sidecar.includes('OTEL_SDK_DISABLED: "true"'), "telemetry platform-uit");

  // De enige gepubliceerde poort in heel het bestand is 127.0.0.1-gebonden.
  const portMappings = [...compose.matchAll(/^\s+- "([^"]*:\d+:\d+)"/gm)].map((m) => m[1]);
  assert.ok(portMappings.length > 0, "minstens één poortmapping verwacht");
  for (const mapping of portMappings) {
    assert.ok(
      mapping.startsWith("127.0.0.1:"),
      `poortmapping niet op loopback: ${mapping}`,
    );
  }

  // P0.8: het eiland ("sidecar") is nu internal: true; model-egress loopt
  // alleen via het dedicated pilot-egress-netwerk aan deze sidecar.
  assertSidecarNetworks(sidecar, "sidecar", "agentscope-sidecar");
  assertEgressDesign(compose, "sidecar", "agentscope-overlay");

  // De overlay declareert zelf geen enkel volume.
  assert.ok(!/^volumes:/m.test(compose), "overlay definieert geen volumes");

  // Gedocumenteerd restrisico (P0.8-header, opvolger van het LANE-C-
  // restrisico): egress via pilot-egress is niet fijnmazig beperkt tot het
  // ModelPort-IP; dat blijft een bewuste operatorhandeling op de
  // host-firewall. Die verantwoording moet in het bestand blijven staan —
  // verdwijnt ze, dan faalt deze guard.
  assert.match(raw, /firewall|egress/i, "egress-caveat moet gedocumenteerd blijven");
});

test("S3c. basiscompose: geen gepubliceerde poorten; store blijft context-vrij", async () => {
  const compose = stripComments(await readFile(BASE_URL, "utf8"));

  for (const name of ["motor-pilot", "motor-pilot-api", "motor-pilot-store"]) {
    const block = anchoredBlock(compose, 2, name);
    assert.ok(!/^    ports:/m.test(block), `${name}: mag geen poorten publiceren`);
  }

  // De store (enige schrijver van /data) mag context noch fysiek noch als
  // configuratie zien; zijn env kent precies twee keys.
  const store = anchoredBlock(compose, 2, "motor-pilot-store");
  assert.ok(!store.includes("pilot-context"), "store mount of benoemt context nooit");
  assert.deepEqual(envKeysOf(store).sort(), ["PILOT_STORE_SECRET", "STORE_PORT"]);
  assert.ok(
    volumeEntriesOf(store).some((entry) => entry === "pilot-drafts:/data"),
    "store is de rw-schrijver van pilot-drafts",
  );

  // De tailscaled-socket (node-identiteit) mag alleen bij de API bestaan,
  // read-only — nooit bij de store of de CLI.
  const api = anchoredBlock(compose, 2, "motor-pilot-api");
  assert.ok(
    api.includes("/run/tailscale/tailscaled.sock:/run/tailscale/tailscaled.sock:ro"),
    "API krijgt de whois-socket read-only",
  );
  const cli = anchoredBlock(compose, 2, "motor-pilot");
  assert.ok(!cli.includes("tailscaled.sock"), "CLI ziet de whois-socket nooit");
  assert.ok(!store.includes("tailscaled.sock"), "store ziet de whois-socket nooit");
});

test("S3d. P0.8-basiscompose: adapter-env met gedragsneutrale defaults; egress-net hoort niet bij api/store/cli", async () => {
  const compose = stripComments(await readFile(BASE_URL, "utf8"));

  // De API krijgt PILOT_ADAPTER + sidecar-URL's als env. De defaults
  // reproduceren het pre-P0.8-gedrag exact (llamacpp direct, sidecar-URL's
  // leeg), zodat deze compose-wijziging de draaiende stack nooit zelf
  // wijzigt — activering is een aparte, service-gescopede live-stap.
  const api = anchoredBlock(compose, 2, "motor-pilot-api");
  for (const key of [
    "PILOT_ADAPTER",
    "HERMES_SIDECAR_URL",
    "AGENTSCOPE_SIDECAR_URL",
  ]) {
    assert.ok(envKeysOf(api).includes(key), `api-env ${key} ontbreekt`);
  }
  assert.ok(
    api.includes("PILOT_ADAPTER: ${PILOT_ADAPTER:-llamacpp}"),
    "de default-adapter blijft llamacpp (gedragsneutraal)",
  );

  // Het egress-netwerk is uitsluitend iets van de sidecar-overlays: de
  // basisdiensten (network_mode: host) kennen het niet en mogen het nooit
  // krijgen — een egress-attachment op de store zou zijn isolatie breken.
  assert.ok(
    !compose.includes("pilot-egress"),
    "basiscompose verwijst nooit naar pilot-egress",
  );
});
