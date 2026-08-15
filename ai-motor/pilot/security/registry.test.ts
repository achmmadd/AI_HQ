/**
 * registry.test.ts — P0.6 spoor C, aanvalspunten 1 en 2.
 *
 * Aanval 1: een adapterselectie buiten de allowlist (PILOT_ADAPTER=evil en
 * varianten) mag nooit een adapter opleveren — adapterFromEnv en
 * createPilotAdapter falen gesloten met een throw, en de registry geeft
 * nooit een niet-geallowlist object terug.
 *
 * Aanval 2: een vrije URL of classnaam uit userinput kan geen adapter en
 * geen sidecar-target worden. De registry kent geen enkel pad van
 * request-body naar adapterkeuze of endpoint: createPilotAdapter heeft
 * geen URL-parameter en leest endpoints uitsluitend uit server-side env;
 * createPilotServer bindt de adapter bij constructie en geeft body-velden
 * als adapter/model_url/baseUrl nooit aan de draft-kern door.
 *
 * Complementair aan de lane-tests: adapter-interne configvalidatie
 * (protocol/timeout-grenzen) wordt daar al bewezen; hier staat de
 * registry-grens en de HTTP-ingang centraal. Alles in-process op
 * 127.0.0.1, geen echte endpoints, geen secrets.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  PILOT_ADAPTER_IDS,
  adapterFromEnv,
  createPilotAdapter,
  isPilotAdapterId,
} from "../registry.ts";
import { createPilotServer, parseAcl } from "../server.ts";
import type { CapabilityAdapter } from "../../lib/adr110/adapters/contract.ts";

test("S1a. adapterselectie buiten de allowlist gooit altijd (fail-closed)", () => {
  const hostile = [
    "evil",
    "Evil",
    "EVIL",
    "LLAMACPP",
    "llamacpp ",
    "llamacpp\n",
    " llamacpp",
    "llamacpp-extra",
    "llamacpp,evil",
    "../evil",
    "../../etc/passwd",
    "http://evil.example.invalid/adapter",
    "https://127.0.0.1:1/x",
    "com.evil.Adapter",
    "__proto__",
    "constructor",
    "prototype",
    "evil\x00llamacpp",
    "",
    " ",
  ];
  for (const raw of hostile) {
    assert.equal(isPilotAdapterId(raw), false, `allowlist-check: ${JSON.stringify(raw)}`);
    assert.throws(
      () => adapterFromEnv({ PILOT_ADAPTER: raw }),
      /niet geallowlist/,
      `adapterFromEnv: ${JSON.stringify(raw)}`,
    );
  }
  // De foutmelding noemt uitsluitend de allowlist — nooit een hint hoe een
  // vreemde naam tóch geladen zou kunnen worden.
  assert.throws(
    () => adapterFromEnv({ PILOT_ADAPTER: "evil" }),
    /llamacpp, hermes, agentscope/,
  );
});

test("S1b. de registry retourneert nooit een niet-geallowlist object", () => {
  assert.deepEqual([...PILOT_ADAPTER_IDS], ["llamacpp", "hermes", "agentscope"]);
  // Structureel: exact deze sleutels, en een brute index met een vijandige
  // naam (incl. prototype-kandidaten) levert nooit een invokeerbaar object.
  // (Observatie voor LANE-C: de exports zijn niet Object.frozen — ongevaarlijk
  // zolang lookups uitsluitend via PILOT_ADAPTER_IDS.includes lopen.)
  const view = PILOT_ADAPTERS as unknown as Record<string, unknown>;
  assert.deepEqual(Object.keys(view).sort(), [...PILOT_ADAPTER_IDS].sort());
  for (const raw of ["evil", "__proto__", "constructor", "prototype", "hasOwnProperty"]) {
    const hit = view[raw];
    assert.equal(
      typeof (hit as CapabilityAdapter | undefined)?.invoke,
      "undefined",
      `registry-index ${JSON.stringify(raw)} mag nooit iets invokeerbaars geven`,
    );
  }

  // Iedere allowlisted naam zonder de bijbehorende server-side env faalt
  // gesloten — de registry fabuleert nooit een default-endpoint.
  assert.throws(() => adapterFromEnv({ PILOT_ADAPTER: "llamacpp" }), /MODEL_PORT_URL/);
  assert.throws(() => adapterFromEnv({ PILOT_ADAPTER: "hermes" }), /HERMES_SIDECAR_URL/);
  assert.throws(() => adapterFromEnv({ PILOT_ADAPTER: "agentscope" }), /AGENTSCOPE_SIDECAR_URL/);

  // Eén geldige constructie als controle: precies de gevraagde binding.
  const { id, adapter } = adapterFromEnv({
    PILOT_ADAPTER: "hermes",
    HERMES_SIDECAR_URL: "http://127.0.0.1:4410",
  });
  assert.equal(id, "hermes");
  assert.equal(adapter.adapter_id, "hermes");
});

test("S1c. de TypeScript-uitgesloten tak kan ook runtime nooit iets bouwen", () => {
  // Een JS-caller zonder typechecking kan de switch met een vreemde naam
  // bereiken. De security-eis is dat er dan NOOIT een adapter-object
  // ontstaat — of de switch gooit, of hij retourneert niets. (Observatie
  // voor LANE-C: de switch heeft geen default-throw; undefined is veilig
  // maar een throw zou luider falen.)
  let result: unknown;
  let threw = false;
  try {
    result = createPilotAdapter("evil" as never, {
      MODEL_PORT_URL: "http://127.0.0.1:1",
      HERMES_SIDECAR_URL: "http://127.0.0.1:2",
      AGENTSCOPE_SIDECAR_URL: "http://127.0.0.1:3",
    });
  } catch {
    threw = true;
  }
  assert.ok(
    threw || result === undefined,
    "er mag nooit een adapter-object uit een niet-geallowlist id ontstaan",
  );
  if (!threw) {
    assert.equal(
      typeof (result as CapabilityAdapter | undefined)?.invoke,
      "undefined",
      "er mag geen invokeerbare structuur terugkomen",
    );
  }
});

test("S2a. de registry heeft geen URL/classname-ingang uit userinput", () => {
  // Zelfs met een geldige adapternaam zijn alle endpoint-velden undefined
  // in een aanvaller-gecontroleerde env → constructie faalt, er ontstaat
  // nooit een adapter die naar een meegegeven URL wijst.
  assert.throws(
    () => adapterFromEnv({ PILOT_ADAPTER: "hermes" }),
    /HERMES_SIDECAR_URL ontbreekt/,
  );
  assert.throws(
    () =>
      adapterFromEnv({
        PILOT_ADAPTER: "agentscope",
        AGENTSCOPE_SIDECAR_URL: "",
      }),
    /AGENTSCOPE_SIDECAR_URL ontbreekt/,
  );
  // Een lege MODEL_NAME is onschadelijk (adapter default), maar een leeg
  // endpoint is altijd fataal — endpoint komt nooit impliciet tot stand.
  assert.throws(
    () => adapterFromEnv({ PILOT_ADAPTER: "llamacpp", MODEL_PORT_URL: "" }),
    /MODEL_PORT_URL ontbreekt/,
  );
});

test("S2b. sidecar-targetconfig faalt gesloten op niet-loopback-protocollen en credentials", () => {
  // De adapterconstructors zijn de tweede lijn: zelfs áls een endpoint via
  // server-side env binnenkomt, wordt geen exotisch schema of credential-
  // dragende URL ooit een sidecar-target.
  assert.throws(
    () =>
      adapterFromEnv({
        PILOT_ADAPTER: "hermes",
        HERMES_SIDECAR_URL: "gopher://127.0.0.1:70/x",
      }),
    /must be http/,
  );
  assert.throws(
    () =>
      adapterFromEnv({
        PILOT_ADAPTER: "hermes",
        HERMES_SIDECAR_URL: "geen-url",
      }),
    /not a valid URL/,
  );
  assert.throws(
    () =>
      adapterFromEnv({
        PILOT_ADAPTER: "agentscope",
        AGENTSCOPE_SIDECAR_URL: "https://127.0.0.1:4410",
      }),
    /plain http without credentials/,
  );
  assert.throws(
    () =>
      adapterFromEnv({
        PILOT_ADAPTER: "agentscope",
        AGENTSCOPE_SIDECAR_URL: "http://user:pw@127.0.0.1:4410",
      }),
    /plain http without credentials/,
  );
});

test("S2c. HTTP: adapter- en endpointvelden in de request-body worden nooit uitgevoerd", async () => {
  // De marker-run bewijst welke implementatie draait; als body-velden ook
  // maar íéts aan binding of endpoint konden wijzigen, zou een andere
  // marker (of een fetch naar de aanvaller-URL) zichtbaar worden.
  const markerCalls: { reviewText: string; isSynthetic: boolean }[] = [];
  const server = createPilotServer({
    acl: parseAcl('{"nPIETJE123CNTRL":["ws-motor"]}'),
    resolveNode: async () => ({ stableId: "nPIETJE123CNTRL", name: "pietje" }),
    runDraftImpl: (async (req: { reviewText: string; isSynthetic: boolean }) => {
      markerCalls.push({ reviewText: req.reviewText, isSynthetic: req.isSynthetic });
      return { ok: true, draft: "marker-van-de-server-adapter" };
    }) as never,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address !== null && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const res = await fetch(`${base}/draft`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        review: "eerlijke review",
        adapter: "evil",
        provider: "com.evil.Adapter",
        model_url: "http://198.51.100.77:9/exfil",
        baseUrl: "http://198.51.100.77:9/exfil",
        sidecar_url: "http://198.51.100.77:9/exfil",
        endpoint: "http://198.51.100.77:9/exfil",
      }),
    });
    assert.equal(res.status, 200);
    const json = (await res.json()) as { ok: boolean; draft: string };
    // De server-gebonden implementatie heeft gedraaid, ongemoeid door de
    // vreemde velden; er is geen enkele netwerk-uitweg naar de meegegeven
    // URL's (de test zou hangen/falen als die fetch werkelijk gebeurde).
    assert.equal(json.ok, true);
    assert.equal(json.draft, "marker-van-de-server-adapter");
    assert.equal(markerCalls.length, 1);
    assert.equal(markerCalls[0].reviewText, "eerlijke review");
    assert.equal(markerCalls[0].isSynthetic, false);
  } finally {
    server.close();
  }
});
