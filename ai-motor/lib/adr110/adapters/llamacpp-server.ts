/**
 * llamacpp-server adapter — a real CapabilityAdapter against a llama.cpp
 * `llama-server` OpenAI-compatible HTTP endpoint (the RTX-pc model runtime).
 *
 * Unlike the pure fake adapters this adapter performs network I/O via global
 * fetch (Node 24, no external dependencies). It still owns nothing durable:
 * no task state, no employee identity, no policy truth, no credentials. The
 * only mutable state is the in-flight request registry (AbortController per
 * attempt) that cancel() needs — the adapter equivalent of a connection pool.
 *
 * Contract mapping:
 * - health(now)  → GET {baseUrl}/health   (200 → ok, 503 → degraded, else down)
 * - invoke(req)  → POST {baseUrl}/v1/chat/completions with stream disabled
 * - cancel(id)   → aborts the in-flight request for that attempt
 *
 * Errors are normalized to the contract error model: NETWORK_ERROR,
 * TIMEOUT, CANCELLED, HTTP_ERROR, INVALID_RESPONSE. Causal ids
 * (task_id, run_id, attempt_id) are echoed from the invoke request.
 *
 * Field note: AdapterResultMeta only has simulated_* fields. For this real
 * adapter `simulated_latency_ms` carries the MEASURED round-trip latency and
 * `simulated_cost_cents` is 0 (local inference, no marginal cost).
 */

import { deepFreeze } from "../digest.ts";
import type { AttemptId, IsoTimestamp } from "../types.ts";
import type {
  AdapterError,
  AdapterHealth,
  AdapterInvokeRequest,
  AdapterResult,
  CapabilityAdapter,
} from "./contract.ts";

export const LLAMACPP_SERVER_ADAPTER_ID = "llamacpp-server";
export const LLAMACPP_SERVER_ADAPTER_VERSION = "0.1.0";

export const LLAMACPP_ERROR_CODES = Object.freeze([
  "NETWORK_ERROR",
  "TIMEOUT",
  "CANCELLED",
  "HTTP_ERROR",
  "INVALID_RESPONSE",
] as const);

export interface LlamaCppServerConfig {
  /** Base URL of the llama-server, e.g. http://100.118.204.123:8080 */
  readonly baseUrl: string;
  /** Model name sent in the chat/completions request body. */
  readonly model: string;
  /** Per-request timeout in milliseconds. */
  readonly timeoutMs: number;
  /** Max tokens to generate (llama.cpp `max_tokens`). */
  readonly maxTokens?: number;
  /** Sampling temperature. */
  readonly temperature?: number;
  /**
   * Qwen3-style thinking mode. Default OFF: with thinking enabled the model
   * spends the whole token budget on `reasoning_content` and `content` stays
   * empty — observed live during the pilot validation on 2026-08-14.
   */
  readonly enableThinking?: boolean;
}

interface ChatCompletionResponse {
  readonly choices?: readonly {
    readonly message?: { readonly content?: unknown };
    readonly finish_reason?: string;
  }[];
}

function normalizeError(
  error: unknown,
  request: AdapterInvokeRequest,
): AdapterError {
  const base = {
    task_id: request.task_id,
    run_id: request.run_id,
    attempt_id: request.attempt_id,
  };
  if (error instanceof DOMException && error.name === "AbortError") {
    return {
      ...base,
      code: "CANCELLED",
      message: "request cancelled via cancel()",
      retryable: false,
    };
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return {
      ...base,
      code: "TIMEOUT",
      message: `request exceeded the configured timeout`,
      retryable: true,
    };
  }
  return {
    ...base,
    code: "NETWORK_ERROR",
    message: `network failure: ${error instanceof Error ? error.message : String(error)}`,
    retryable: true,
  };
}

export function createLlamaCppServerAdapter(
  config: LlamaCppServerConfig,
): CapabilityAdapter {
  const baseUrl = config.baseUrl.replace(/\/+$/, "");
  const inFlight = new Map<string, AbortController>();

  return deepFreeze({
    adapter_id: LLAMACPP_SERVER_ADAPTER_ID,
    adapter_version: LLAMACPP_SERVER_ADAPTER_VERSION,
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
          signal: AbortSignal.timeout(config.timeoutMs),
        });
        if (response.status === 200) status = "ok";
        else if (response.status === 503) status = "degraded";
      } catch {
        status = "down";
      }
      return {
        adapter_id: LLAMACPP_SERVER_ADAPTER_ID,
        adapter_version: LLAMACPP_SERVER_ADAPTER_VERSION,
        status,
        checked_at: now,
      };
    },

    async invoke(request: AdapterInvokeRequest): Promise<AdapterResult> {
      const controller = new AbortController();
      inFlight.set(request.attempt_id as string, controller);
      const started = Date.now();
      try {
        const response = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: config.model,
            messages: [{ role: "user", content: request.input }],
            stream: false,
            chat_template_kwargs: {
              enable_thinking: config.enableThinking ?? false,
            },
            ...(config.maxTokens !== undefined
              ? { max_tokens: config.maxTokens }
              : {}),
            ...(config.temperature !== undefined
              ? { temperature: config.temperature }
              : {}),
          }),
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(config.timeoutMs),
          ]),
        });
        if (!response.ok) {
          const snippet = (await response.text().catch(() => "")).slice(0, 200);
          return {
            ok: false,
            error: {
              code: "HTTP_ERROR",
              message: `llama-server HTTP ${response.status}: ${snippet}`,
              retryable: response.status === 429 || response.status >= 500,
              task_id: request.task_id,
              run_id: request.run_id,
              attempt_id: request.attempt_id,
            },
          };
        }
        let body: ChatCompletionResponse;
        try {
          body = (await response.json()) as ChatCompletionResponse;
        } catch {
          return {
            ok: false,
            error: {
              code: "INVALID_RESPONSE",
              message: "response body is not valid JSON",
              retryable: false,
              task_id: request.task_id,
              run_id: request.run_id,
              attempt_id: request.attempt_id,
            },
          };
        }
        const content = body.choices?.[0]?.message?.content;
        if (typeof content !== "string" || content.length === 0) {
          return {
            ok: false,
            error: {
              code: "INVALID_RESPONSE",
              message: "response has no choices[0].message.content string",
              retryable: false,
              task_id: request.task_id,
              run_id: request.run_id,
              attempt_id: request.attempt_id,
            },
          };
        }
        return {
          ok: true,
          output: content,
          meta: {
            adapter_id: LLAMACPP_SERVER_ADAPTER_ID,
            adapter_version: LLAMACPP_SERVER_ADAPTER_VERSION,
            simulated_latency_ms: Date.now() - started,
            simulated_cost_cents: 0,
            task_id: request.task_id,
            run_id: request.run_id,
            attempt_id: request.attempt_id,
          },
        };
      } catch (error) {
        return { ok: false, error: normalizeError(error, request) };
      } finally {
        inFlight.delete(request.attempt_id as string);
      }
    },

    cancel(attempt_id: AttemptId) {
      const controller = inFlight.get(attempt_id as string);
      if (controller === undefined) {
        return { cancelled: false, attempt_id };
      }
      controller.abort();
      inFlight.delete(attempt_id as string);
      return { cancelled: true, attempt_id };
    },
  });
}
