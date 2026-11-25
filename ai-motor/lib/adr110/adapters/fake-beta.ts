/**
 * FakeAdapterB ("fake-beta") — a different simulated runtime/provider:
 * different fake latency/cost metadata and output format, same contract.
 * Deterministic, synchronous, no I/O. Owns no task state, employee identity,
 * policy truth or credentials.
 */

import { deepFreeze } from "../digest.ts";
import type { IsoTimestamp } from "../types.ts";
import type {
  AdapterInvokeRequest,
  AdapterResult,
  CapabilityAdapter,
} from "./contract.ts";

export const FAKE_BETA_ID = "fake-beta";
export const FAKE_BETA_VERSION = "0.2.0";
export const FAKE_BETA_SIMULATED_LATENCY_MS = 45;
export const FAKE_BETA_SIMULATED_COST_CENTS = 7;

export function createFakeBetaAdapter(): CapabilityAdapter {
  return deepFreeze({
    adapter_id: FAKE_BETA_ID,
    adapter_version: FAKE_BETA_VERSION,
    capabilities: ["draft.generate"],
    requirements: {
      data_classes: ["public", "internal"],
      network: "none",
    },

    health(now: IsoTimestamp) {
      return {
        adapter_id: FAKE_BETA_ID,
        adapter_version: FAKE_BETA_VERSION,
        status: "ok",
        checked_at: now,
      };
    },

    invoke(request: AdapterInvokeRequest): AdapterResult {
      if (request.input.includes("FAIL")) {
        return {
          ok: false,
          error: {
            code: "SIMULATED_FAILURE",
            message: "fake-beta simulated a retryable failure",
            retryable: true,
            task_id: request.task_id,
            run_id: request.run_id,
            attempt_id: request.attempt_id,
          },
        };
      }
      return {
        ok: true,
        output: `<beta:${FAKE_BETA_VERSION}> ${request.input} </beta>`,
        meta: {
          adapter_id: FAKE_BETA_ID,
          adapter_version: FAKE_BETA_VERSION,
          simulated_latency_ms: FAKE_BETA_SIMULATED_LATENCY_MS,
          simulated_cost_cents: FAKE_BETA_SIMULATED_COST_CENTS,
          task_id: request.task_id,
          run_id: request.run_id,
          attempt_id: request.attempt_id,
        },
      };
    },

    cancel(attempt_id) {
      return { cancelled: true, attempt_id };
    },
  });
}
