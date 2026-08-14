/**
 * FakeAdapterA ("fake-alpha") — simulated runtime/provider binding.
 * Deterministic, synchronous, no I/O. Owns no task state, employee identity,
 * policy truth or credentials. Input containing "FAIL" yields the normalized
 * error model.
 */

import { deepFreeze } from "../digest.ts";
import type { IsoTimestamp } from "../types.ts";
import type {
  AdapterInvokeRequest,
  AdapterResult,
  CapabilityAdapter,
} from "./contract.ts";

export const FAKE_ALPHA_ID = "fake-alpha";
export const FAKE_ALPHA_VERSION = "0.1.0";
export const FAKE_ALPHA_SIMULATED_LATENCY_MS = 120;
export const FAKE_ALPHA_SIMULATED_COST_CENTS = 3;

export function createFakeAlphaAdapter(): CapabilityAdapter {
  return deepFreeze({
    adapter_id: FAKE_ALPHA_ID,
    adapter_version: FAKE_ALPHA_VERSION,
    capabilities: ["draft.generate"],
    requirements: {
      data_classes: ["public", "internal"],
      network: "none",
    },

    health(now: IsoTimestamp) {
      return {
        adapter_id: FAKE_ALPHA_ID,
        adapter_version: FAKE_ALPHA_VERSION,
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
            message: "fake-alpha simulated a retryable failure",
            retryable: true,
            task_id: request.task_id,
            run_id: request.run_id,
            attempt_id: request.attempt_id,
          },
        };
      }
      return {
        ok: true,
        output: `[alpha] draft for ${String(request.task_id)}: ${request.input}`,
        meta: {
          adapter_id: FAKE_ALPHA_ID,
          adapter_version: FAKE_ALPHA_VERSION,
          simulated_latency_ms: FAKE_ALPHA_SIMULATED_LATENCY_MS,
          simulated_cost_cents: FAKE_ALPHA_SIMULATED_COST_CENTS,
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
