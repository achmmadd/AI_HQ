/**
 * hermes adapter — a real CapabilityAdapter ("hermes") against a Hermes
 * agent runtime via the phase-0 sidecar protocol (integration sprint
 * 2026-08-14, see pilot/evidence/integration-sprint/PHASE-0.md):
 *
 *   GET  {baseUrl}/health  → { "status": "ok" | "degraded" | "down" } (≤ 5 s)
 *   POST {baseUrl}/invoke  → body { task_id, run_id, attempt_id, input };
 *                            answer { output } + exact echo of the causal ids
 *   POST {baseUrl}/cancel  → body { attempt_id }; answer { cancelled } (≤ 5 s)
 *
 * HTTP/JSON only, loopback/internal endpoints only; request and response
 * bodies are capped at 1 MiB and the invoke timeout never exceeds 120 s.
 * The base URL is runtime configuration (constructor), never hardcoded —
 * the repository contains no real endpoints.
 *
 * Errors are normalized to the single phase-0 I/O taxonomy — exactly these
 * codes, no adapter-specific ones:
 *   unavailable        sidecar unreachable, or HTTP 429/5xx        (retryable)
 *   timeout            the bounded wait was exceeded               (retryable)
 *   cancelled          the attempt was cancelled via cancel()      (terminal)
 *   malformed_response broken/oversized/wrong-schema response, or a
 *                      request that cannot fit the protocol bounds (terminal)
 *   causal_mismatch    task/run/attempt echo ≠ request             (terminal)
 *
 * cancel() is async (phase-0 seam decision 1): it aborts the in-flight
 * invoke locally AND asks the sidecar to cancel the attempt. It never
 * throws; when the sidecar cannot be reached the result reflects the local
 * abort only.
 *
 * The adapter owns nothing durable: no task state, no employee identity, no
 * policy truth, no credentials. The only mutable state is the in-flight
 * AbortController registry that cancel() needs — the adapter equivalent of
 * a connection pool.
 *
 * Field note (phase-0 decision 2): AdapterResultMeta only has simulated_*
 * fields. For this real adapter `simulated_latency_ms` carries the MEASURED
 * round-trip latency and `simulated_cost_cents` is 0 (self-hosted runtime,
 * no marginal cost) — the field name is metadata semantics, not a claim.
 */

import { deepFreeze } from "../../digest.ts";
import type { AttemptId, IsoTimestamp } from "../../types.ts";
import type {
  AdapterCancelResult,
  AdapterError,
  AdapterHealth,
  AdapterInvokeRequest,
  AdapterResult,
  CapabilityAdapter,
} from "../contract.ts";

export const HERMES_ADAPTER_ID = "hermes";
export const HERMES_ADAPTER_VERSION = "0.1.0";

/** The complete phase-0 I/O error taxonomy — exactly these, no others. */
export const HERMES_ERROR_CODES = Object.freeze([
  "unavailable",
  "timeout",
  "cancelled",
  "malformed_response",
  "causal_mismatch",
] as const);

export type HermesErrorCode = (typeof HERMES_ERROR_CODES)[number];

/** Phase-0 protocol bounds: bodies ≤ 1 MiB, invoke ≤ 120 s, handshake ≤ 5 s. */
export const HERMES_MAX_BODY_BYTES = 1024 * 1024;
export const HERMES_MAX_INVOKE_TIMEOUT_MS = 120_000;
export const HERMES_MAX_HANDSHAKE_TIMEOUT_MS = 5_000;

export interface HermesAdapterConfig {
  /**
   * Base URL of the hermes sidecar. Runtime configuration only (env
   * HERMES_SIDECAR_URL); a loopback or internal-network address such as
   * http://127.0.0.1:4410 — the repository never contains a real endpoint.
   */
  readonly baseUrl: string;
  /** Invoke timeout in ms; protocol-capped at 120 000. Default 120 000. */
  readonly invokeTimeoutMs?: number;
  /** Health/cancel timeout in ms; protocol-capped at 5 000. Default 5 000. */
  readonly handshakeTimeoutMs?: number;
  /**
   * fetch implementation — injectable so tests can run a scripted
   * in-process fake sidecar without any real network I/O. Defaults to the
   * global fetch.
   */
  readonly fetchImpl?: typeof fetch;
}

interface SidecarHealthResponse {
  readonly status?: unknown;
}

interface SidecarInvokeResponse {
  readonly output?: unknown;
  readonly task_id?: unknown;
  readonly run_id?: unknown;
  readonly attempt_id?: unknown;
}

interface SidecarCancelResponse {
  readonly cancelled?: unknown;
}

function boundedTimeout(
  value: number | undefined,
  fallback: number,
  max: number,
  name: string,
): number {
  const resolved = value ?? fallback;
  if (!Number.isFinite(resolved) || resolved <= 0 || resolved > max) {
    throw new Error(`hermes: ${name} must be within 1..${max} ms, got ${resolved}`);
  }
  return resolved;
}

function assertBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`hermes: baseUrl is not a valid URL`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`hermes: baseUrl must be http(s), got ${url.protocol}`);
  }
  return raw.replace(/\/+$/, "");
}

function taxonomyError(
  code: HermesErrorCode,
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

function normalizeTransportError(
  error: unknown,
  request: AdapterInvokeRequest,
  invokeTimeoutMs: number,
): AdapterError {
  if (error instanceof DOMException && error.name === "AbortError") {
    return taxonomyError(
      "cancelled",
      "attempt cancelled via cancel()",
      false,
      request,
    );
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return taxonomyError(
      "timeout",
      `invoke exceeded the configured ${invokeTimeoutMs} ms timeout`,
      true,
      request,
    );
  }
  return taxonomyError(
    "unavailable",
    `sidecar unreachable: ${error instanceof Error ? error.message : String(error)}`,
    true,
    request,
  );
}

export function createHermesAdapter(
  config: HermesAdapterConfig,
): CapabilityAdapter {
  const baseUrl = assertBaseUrl(config.baseUrl);
  const invokeTimeoutMs = boundedTimeout(
    config.invokeTimeoutMs,
    HERMES_MAX_INVOKE_TIMEOUT_MS,
    HERMES_MAX_INVOKE_TIMEOUT_MS,
    "invokeTimeoutMs",
  );
  const handshakeTimeoutMs = boundedTimeout(
    config.handshakeTimeoutMs,
    HERMES_MAX_HANDSHAKE_TIMEOUT_MS,
    HERMES_MAX_HANDSHAKE_TIMEOUT_MS,
    "handshakeTimeoutMs",
  );
  const fetchImpl: typeof fetch =
    config.fetchImpl ?? ((input, init) => fetch(input, init));
  const inFlight = new Map<string, AbortController>();

  return deepFreeze({
    adapter_id: HERMES_ADAPTER_ID,
    adapter_version: HERMES_ADAPTER_VERSION,
    capabilities: ["draft.generate"],
    requirements: {
      data_classes: ["public", "internal"],
      network: "egress",
    },

    async health(now: IsoTimestamp): Promise<AdapterHealth> {
      let status: AdapterHealth["status"] = "down";
      try {
        const response = await fetchImpl(`${baseUrl}/health`, {
          method: "GET",
          signal: AbortSignal.timeout(handshakeTimeoutMs),
        });
        if (response.ok) {
          const declared = Number(response.headers.get("content-length") ?? 0);
          if (declared <= HERMES_MAX_BODY_BYTES) {
            const parsed = (await response
              .json()
              .catch(() => null)) as SidecarHealthResponse | null;
            const candidate = parsed?.status;
            if (
              candidate === "ok" ||
              candidate === "degraded" ||
              candidate === "down"
            ) {
              status = candidate;
            }
          }
        }
      } catch {
        status = "down";
      }
      return {
        adapter_id: HERMES_ADAPTER_ID,
        adapter_version: HERMES_ADAPTER_VERSION,
        status,
        checked_at: now,
      };
    },

    async invoke(request: AdapterInvokeRequest): Promise<AdapterResult> {
      // Phase-0 protocol body: exactly the causal ids + input, nothing else
      // (no manifest, agent or binding data crosses the sidecar boundary).
      const body = JSON.stringify({
        task_id: request.task_id,
        run_id: request.run_id,
        attempt_id: request.attempt_id,
        input: request.input,
      });
      if (Buffer.byteLength(body, "utf8") > HERMES_MAX_BODY_BYTES) {
        return {
          ok: false,
          error: taxonomyError(
            "malformed_response",
            "request body exceeds the 1 MiB protocol bound",
            false,
            request,
          ),
        };
      }

      const controller = new AbortController();
      inFlight.set(request.attempt_id as string, controller);
      const started = Date.now();
      let response: Response;
      try {
        response = await fetchImpl(`${baseUrl}/invoke`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body,
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(invokeTimeoutMs),
          ]),
        });
      } catch (error) {
        return {
          ok: false,
          error: normalizeTransportError(error, request, invokeTimeoutMs),
        };
      } finally {
        inFlight.delete(request.attempt_id as string);
      }

      if (!response.ok) {
        const snippet = (await response.text().catch(() => "")).slice(0, 200);
        if (response.status === 429 || response.status >= 500) {
          return {
            ok: false,
            error: taxonomyError(
              "unavailable",
              `sidecar HTTP ${response.status}: ${snippet}`,
              true,
              request,
            ),
          };
        }
        return {
          ok: false,
          error: taxonomyError(
            "malformed_response",
            `unexpected sidecar HTTP ${response.status}: ${snippet}`,
            false,
            request,
          ),
        };
      }

      const declared = Number(response.headers.get("content-length") ?? 0);
      if (declared > HERMES_MAX_BODY_BYTES) {
        return {
          ok: false,
          error: taxonomyError(
            "malformed_response",
            `response content-length ${declared} exceeds the 1 MiB protocol bound`,
            false,
            request,
          ),
        };
      }
      const text = await response.text().catch(() => null);
      if (text === null) {
        return {
          ok: false,
          error: taxonomyError(
            "malformed_response",
            "response body could not be read",
            false,
            request,
          ),
        };
      }
      if (Buffer.byteLength(text, "utf8") > HERMES_MAX_BODY_BYTES) {
        return {
          ok: false,
          error: taxonomyError(
            "malformed_response",
            "response body exceeds the 1 MiB protocol bound",
            false,
            request,
          ),
        };
      }
      let parsed: SidecarInvokeResponse;
      try {
        parsed = JSON.parse(text) as SidecarInvokeResponse;
      } catch {
        return {
          ok: false,
          error: taxonomyError(
            "malformed_response",
            "response body is not valid JSON",
            false,
            request,
          ),
        };
      }
      if (typeof parsed.output !== "string" || parsed.output.length === 0) {
        return {
          ok: false,
          error: taxonomyError(
            "malformed_response",
            "response has no non-empty output string",
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
          error: taxonomyError(
            "causal_mismatch",
            "sidecar echo of task/run/attempt ids differs from the request",
            false,
            request,
          ),
        };
      }
      return {
        ok: true,
        output: parsed.output,
        meta: {
          adapter_id: HERMES_ADAPTER_ID,
          adapter_version: HERMES_ADAPTER_VERSION,
          simulated_latency_ms: Date.now() - started,
          simulated_cost_cents: 0,
          task_id: request.task_id,
          run_id: request.run_id,
          attempt_id: request.attempt_id,
        },
      };
    },

    async cancel(attempt_id: AttemptId): Promise<AdapterCancelResult> {
      const controller = inFlight.get(attempt_id as string);
      const locallyAborted = controller !== undefined;
      if (controller !== undefined) {
        controller.abort();
        inFlight.delete(attempt_id as string);
      }
      try {
        const response = await fetchImpl(`${baseUrl}/cancel`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ attempt_id }),
          signal: AbortSignal.timeout(handshakeTimeoutMs),
        });
        if (response.ok) {
          const parsed = (await response
            .json()
            .catch(() => null)) as SidecarCancelResponse | null;
          if (typeof parsed?.cancelled === "boolean") {
            return {
              cancelled: parsed.cancelled || locallyAborted,
              attempt_id,
            };
          }
        }
      } catch {
        // Sidecar unreachable or timed out: report the local abort only.
      }
      return { cancelled: locallyAborted, attempt_id };
    },
  });
}
