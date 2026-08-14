/**
 * Allowlisted adapterregistry (coördinator, integratiefase).
 *
 * De API kiest een adapter uitsluitend op vaste naam uit deze lijst; er is
 * geen vrije provider-URL of classnaam uit userinput. Endpoints komen
 * uitsluitend uit server-side env — nooit uit een request.
 *
 * Onbekende of ontbrekende selectie faalt gesloten (throw bij opstarten).
 */

import type { CapabilityAdapter } from "../lib/adr110/adapters/contract.ts";
import { createLlamaCppServerAdapter } from "../lib/adr110/adapters/llamacpp-server.ts";
import { createHermesAdapter } from "../lib/adr110/adapters/hermes/adapter.ts";
import { createAgentScopeAdapter } from "../lib/adr110/adapters/agentscope/sidecar-client.ts";

export const PILOT_ADAPTER_IDS = ["llamacpp", "hermes", "agentscope"] as const;
export type PilotAdapterId = (typeof PILOT_ADAPTER_IDS)[number];

export function isPilotAdapterId(value: string): value is PilotAdapterId {
  return (PILOT_ADAPTER_IDS as readonly string[]).includes(value);
}

export interface PilotAdapterEnv {
  /** llamacpp: base URL van de llama-server (ModelPort). */
  readonly MODEL_PORT_URL?: string;
  readonly MODEL_NAME?: string;
  readonly MODEL_TIMEOUT_MS?: string;
  /** hermes/agentscope: loopback sidecar URLs. */
  readonly HERMES_SIDECAR_URL?: string;
  readonly AGENTSCOPE_SIDECAR_URL?: string;
}

export function createPilotAdapter(
  id: PilotAdapterId,
  env: PilotAdapterEnv,
): CapabilityAdapter {
  switch (id) {
    case "llamacpp": {
      const baseUrl = env.MODEL_PORT_URL;
      if (baseUrl === undefined || baseUrl === "") {
        throw new Error("MODEL_PORT_URL ontbreekt voor adapter llamacpp");
      }
      return createLlamaCppServerAdapter({
        baseUrl,
        model: env.MODEL_NAME ?? "pilot-model",
        timeoutMs: Number(env.MODEL_TIMEOUT_MS ?? "120000"),
      });
    }
    case "hermes": {
      const sidecarUrl = env.HERMES_SIDECAR_URL;
      if (sidecarUrl === undefined || sidecarUrl === "") {
        throw new Error("HERMES_SIDECAR_URL ontbreekt voor adapter hermes");
      }
      return createHermesAdapter({ sidecarUrl, invokeTimeoutMs: 120_000 });
    }
    case "agentscope": {
      const sidecarUrl = env.AGENTSCOPE_SIDECAR_URL;
      if (sidecarUrl === undefined || sidecarUrl === "") {
        throw new Error("AGENTSCOPE_SIDECAR_URL ontbreekt voor adapter agentscope");
      }
      return createAgentScopeAdapter({ sidecarUrl, invokeTimeoutMs: 120_000 });
    }
  }
}

/** Lees de geselecteerde adapter uit env; fail-closed bij onbekende naam. */
export function adapterFromEnv(env: PilotAdapterEnv & { PILOT_ADAPTER?: string }): {
  id: PilotAdapterId;
  adapter: CapabilityAdapter;
} {
  const raw = env.PILOT_ADAPTER ?? "llamacpp";
  if (!isPilotAdapterId(raw)) {
    throw new Error(
      `PILOT_ADAPTER '${raw}' is niet geallowlist (${PILOT_ADAPTER_IDS.join(", ")})`,
    );
  }
  return { id: raw, adapter: createPilotAdapter(raw, env) };
}
