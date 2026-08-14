/**
 * agentscope adapter — a real CapabilityAdapter against the local AgentScope
 * sidecar (pilot/adapters/agentscope/sidecar.py), speaking exactly the
 * phase-0 sidecar protocol of the integration sprint:
 *
 *   GET  /health → { status: "ok" | "degraded" | "down" }          (≤ 5 s)
 *   POST /invoke → { task_id, run_id, attempt_id, input }
 *                → { output, task_id, run_id, attempt_id }         (≤ 120 s)
 *   POST /cancel → { attempt_id } → { cancelled }                  (≤ 5 s)
 *
 * The adapter verifies the causal-id echo on every invoke response; a
 * mismatch fails closed as `causal_mismatch`. Request and response bodies
 * are capped at 1 MiB. Errors normalize to the shared phase-0 taxonomy:
 * unavailable (retryable) / timeout (retryable) / cancelled /
 * malformed_response / causal_mismatch — no adapter-specific codes.
 *
 * The adapter owns nothing: no task state, no employee identity, no policy
 * truth, no credentials, and no retry loop (retry belongs to the Motor
 * engine). The only mutable state is the in-flight request registry
 * (AbortController per attempt) that cancel() needs — the adapter
 * equivalent of a connection pool, kept in the closure so the frozen
 * adapter object itself carries no state.
 *
 * Field note (phase-0 decision 2): `simulated_latency_ms` carries the
 * MEASURED round-trip latency and `simulated_cost_cents` is 0 (local
 * inference via the Motor ModelPort, no marginal cost).
 */

import { deepFreeze } from "../../digest.ts";
import type { AttemptId, IsoTimestamp } from "../../types.ts";
import type {
  AdapterError,
  AdapterHealth,
  AdapterInvokeRequest,
  AdapterResult,
  CapabilityAdapter,
} from "../contract.ts";

export const AGENTSCOPE_ADAPTER_ID = "agentscope";
export const AGENTSCOPE_ADAPTER_VERSION = "0.1.0";

/** The complete phase-0 error taxonomy; no other codes may appear. */
export const AGENTSCOPE_ERROR_CODES = Object.freeze([
  "unavailable",
  "timeout",
  "cancelled",
  "malformed_response",
  "causal_mismatch",
] as const);

/** Protocol bounds from PHASE-0.md (decision 4). */
export const AGENTSCOPE_PROTOCOL_LIMITS = Object.freeze({
  MAX_BODY_BYTES: 1_048_576, // 1 MiB, request and response
  MAX_INVOKE_TIMEOUT_MS: 120_000,
  MAX_SHORT_TIMEOUT_MS: 5_000, // health and cancel
} as const);

export interface AgentScopeSidecarConfig {
  /**
   * Base URL of the loopback sidecar, e.g. http://127.0.0.1:4410. Runtime
   * configuration only — the repository never contains a real endpoint.
   * Plain http only: the sidecar binds loopback and terminates no TLS.
   */
  readonly sidecarUrl: string;
  /** Invoke timeout in ms (protocol max 120_000). */
  readonly invokeTimeoutMs: number;
  /** Health timeout in ms (protocol max 5_000). */
  readonly healthTimeoutMs?: number;
  /** Cancel timeout in ms (protocol max 5_000). */
  readonly cancelTimeoutMs?: number;
  /** Body cap in bytes for both directions (protocol max 1 MiB). */
  readonly maxBodyBytes?: number;
}

interface InvokeEcho {
  readonly output?: unknown;
  readonly task_id?: unknown;
  readonly run_id?: unknown;
  readonly attempt_id?: unknown;
}

function assertBounded(
  name: string,
  value: number,
  max: number,
): void {
  if (!Number.isInteger(value) || value < 1 || value > max) {
    throw new RangeError(`${name} must be an integer in 1..${max}, got ${value}`);
  }
}

function makeError(
  code: (typeof AGENTSCOPE_ERROR_CODES)[number],
  message: string,
  retryable: boolean,
  request: AdapterInvokeRequest,
): AdapterError {
  return {
    code,
    message,
    retryable,
    task_id: request.task_id,
    run_id: request.run_id,
    attempt_id: request.attempt_id,
  };
}

/**
 * Reads a response body with a hard byte cap. Returns null when the declared
 * or actual size exceeds the cap; the caller maps that to
 * `malformed_response`. Never throws on size — only on transport errors.
 */
async function readCappedBody(
  response: Response,
  maxBytes: number,
): Promise<string | null> {
  const declared = response.headers.get("content-length");
  if (declared !== null) {
    const n = Number(declared);
    if (Number.isFinite(n) && n > maxBytes) return null;
  }
  if (response.body === null) {
    const text = await response.text();
    return new TextEncoder().encode(text).byteLength > maxBytes ? null : text;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function normalizeInvokeError(
  error: unknown,
  request: AdapterInvokeRequest,
): AdapterError {
  if (error instanceof DOMException && error.name === "AbortError") {
    return makeError(
      "cancelled",
      "request cancelled via cancel()",
      false,
      request,
    );
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return makeError(
      "timeout",
      "sidecar invoke exceeded the configured timeout",
      true,
      request,
    );
  }
  return makeError(
    "unavailable",
    `sidecar unreachable: ${error instanceof Error ? error.message : String(error)}`,
    true,
    request,
  );
}

export function createAgentScopeAdapter(
  config: AgentScopeSidecarConfig,
): CapabilityAdapter {
  const url = new URL(config.sidecarUrl);
  if (url.protocol !== "http:" || url.username !== "" || url.password !== "") {
    throw new RangeError(
      "sidecarUrl must be plain http without credentials (loopback sidecar)",
    );
  }
  const baseUrl = config.sidecarUrl.replace(/\/+$/, "");
  const invokeTimeoutMs = config.invokeTimeoutMs;
  const healthTimeoutMs = config.healthTimeoutMs ?? 5_000;
  const cancelTimeoutMs = config.cancelTimeoutMs ?? 5_000;
  const maxBodyBytes = config.maxBodyBytes ?? 1_048_576;
  assertBounded(
    "invokeTimeoutMs",
    invokeTimeoutMs,
    AGENTSCOPE_PROTOCOL_LIMITS.MAX_INVOKE_TIMEOUT_MS,
  );
  assertBounded(
    "healthTimeoutMs",
    healthTimeoutMs,
    AGENTSCOPE_PROTOCOL_LIMITS.MAX_SHORT_TIMEOUT_MS,
  );
  assertBounded(
    "cancelTimeoutMs",
    cancelTimeoutMs,
    AGENTSCOPE_PROTOCOL_LIMITS.MAX_SHORT_TIMEOUT_MS,
  );
  assertBounded(
    "maxBodyBytes",
    maxBodyBytes,
    AGENTSCOPE_PROTOCOL_LIMITS.MAX_BODY_BYTES,
  );

  const inFlight = new Map<string, AbortController>();

  return deepFreeze({
    adapter_id: AGENTSCOPE_ADAPTER_ID,
    adapter_version: AGENTSCOPE_ADAPTER_VERSION,
    capabilities: ["draft.generate"],
    requirements: {
      data_classes: ["public", "internal"],
      network: "egress",
    },

    async health(now: IsoTimestamp): Promise<AdapterHealth> {
      let status: AdapterHealth["status"] = "down";
      try {
        const response = await fetch(`${baseUrl}/health`, {
          method: "GET",
          signal: AbortSignal.timeout(healthTimeoutMs),
        });
        if (response.status === 200) {
          const text = await readCappedBody(response, maxBodyBytes);
          if (text !== null) {
            try {
              const body = JSON.parse(text) as { status?: unknown };
              if (
                body.status === "ok" ||
                body.status === "degraded" ||
                body.status === "down"
              ) {
                status = body.status;
              }
            } catch {
              status = "down";
            }
          }
        }
      } catch {
        status = "down";
      }
      return {
        adapter_id: AGENTSCOPE_ADAPTER_ID,
        adapter_version: AGENTSCOPE_ADAPTER_VERSION,
        status,
        checked_at: now,
      };
    },

    async invoke(request: AdapterInvokeRequest): Promise<AdapterResult> {
      const body = JSON.stringify({
        task_id: request.task_id,
        run_id: request.run_id,
        attempt_id: request.attempt_id,
        input: request.input,
      });
      if (new TextEncoder().encode(body).byteLength > maxBodyBytes) {
        return {
          ok: false,
          error: makeError(
            "malformed_response",
            "request body exceeds the 1 MiB protocol cap; not sent",
            false,
            request,
          ),
        };
      }
      if (inFlight.has(request.attempt_id as string)) {
        return {
          ok: false,
          error: makeError(
            "unavailable",
            "attempt_id already in flight; the engine must not reuse it",
            false,
            request,
          ),
        };
      }
      const controller = new AbortController();
      inFlight.set(request.attempt_id as string, controller);
      const started = Date.now();
      try {
        const response = await fetch(`${baseUrl}/invoke`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(invokeTimeoutMs),
          ]),
        });
        if (!response.ok) {
          const snippet =
            (await readCappedBody(response, maxBodyBytes).catch(() => null))
              ?.slice(0, 200) ?? "";
          return {
            ok: false,
            error: makeError(
              "unavailable",
              `sidecar HTTP ${response.status}: ${snippet}`,
              response.status === 429 || response.status >= 500,
              request,
            ),
          };
        }
        const text = await readCappedBody(response, maxBodyBytes);
        if (text === null) {
          return {
            ok: false,
            error: makeError(
              "malformed_response",
              "response body exceeds the 1 MiB protocol cap",
              false,
              request,
            ),
          };
        }
        let parsed: InvokeEcho;
        try {
          parsed = JSON.parse(text) as InvokeEcho;
        } catch {
          return {
            ok: false,
            error: makeError(
              "malformed_response",
              "response body is not valid JSON",
              false,
              request,
            ),
          };
        }
        if (
          typeof parsed !== "object" ||
          parsed === null ||
          typeof parsed.output !== "string" ||
          parsed.output.length === 0
        ) {
          return {
            ok: false,
            error: makeError(
              "malformed_response",
              "response has no non-empty output string",
              false,
              request,
            ),
          };
        }
        if (
          typeof parsed.task_id !== "string" ||
          typeof parsed.run_id !== "string" ||
          typeof parsed.attempt_id !== "string"
        ) {
          return {
            ok: false,
            error: makeError(
              "malformed_response",
              "response lacks the causal-id echo fields",
              false,
              request,
            ),
          };
        }
        if (
          parsed.task_id !== (request.task_id as string) ||
          parsed.run_id !== (request.run_id as string) ||
          parsed.attempt_id !== (request.attempt_id as string)
        ) {
          return {
            ok: false,
            error: makeError(
              "causal_mismatch",
              "sidecar echoed different causal ids than invoked with",
              false,
              request,
            ),
          };
        }
        return {
          ok: true,
          output: parsed.output,
          meta: {
            adapter_id: AGENTSCOPE_ADAPTER_ID,
            adapter_version: AGENTSCOPE_ADAPTER_VERSION,
            simulated_latency_ms: Date.now() - started,
            simulated_cost_cents: 0,
            task_id: request.task_id,
            run_id: request.run_id,
            attempt_id: request.attempt_id,
          },
        };
      } catch (error) {
        return { ok: false, error: normalizeInvokeError(error, request) };
      } finally {
        inFlight.delete(request.attempt_id as string);
      }
    },

    async cancel(attempt_id: AttemptId) {
      const controller = inFlight.get(attempt_id as string);
      const localAbort = controller !== undefined;
      if (controller !== undefined) {
        controller.abort();
        inFlight.delete(attempt_id as string);
      }
      let remoteAck = false;
      try {
        const response = await fetch(`${baseUrl}/cancel`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ attempt_id }),
          signal: AbortSignal.timeout(cancelTimeoutMs),
        });
        if (response.ok) {
          const text = await readCappedBody(response, maxBodyBytes);
          if (text !== null) {
            try {
              const body = JSON.parse(text) as { cancelled?: unknown };
              remoteAck = body.cancelled === true;
            } catch {
              remoteAck = false;
            }
          }
        }
      } catch {
        remoteAck = false;
      }
      return { cancelled: localAbort || remoteAck, attempt_id };
    },
  });
}
