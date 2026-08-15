#!/usr/bin/env python3
"""agentscope-sidecar — Motor pilot sidecar (runtime activation, lane B).

Speaks exactly the phase-0 sidecar protocol over loopback HTTP/JSON:

    GET  /health  -> {"status": "ok" | "degraded" | "down", "protocol": ...}
    POST /invoke  -> {"task_id", "run_id", "attempt_id", "input"}
                  -> {"output", "task_id", "run_id", "attempt_id", "protocol": ...}
    POST /cancel  -> {"attempt_id"} -> {"cancelled": bool, "protocol": ...}

Every response — including errors — carries "protocol": "motor-sidecar/1".

Real readiness: /health verifies that (a) the asyncio model loop thread is
alive and (b) the configured ModelPort endpoint answers a bounded HTTP GET
({MODEL_PORT_URL}/models, 2 s). Loop dead -> "down"; model endpoint
unreachable -> "degraded"; both fine -> "ok". No caching, no stub status.

The model call is a real agentscope==2.0.6 invocation: OpenAIChatModel bound
exclusively to the Motor ModelPort (base_url from env MODEL_PORT_URL; in
tests/CI a FAKE endpoint, never the real RTX). Retry belongs to the Motor
engine, so retry is disabled at both levels: agentscope max_retries=0 and
openai client max_retries=0. A cancelled invoke surfaces through agentscope
2.0.6 as ChatResponse(finished_reason=INTERRUPTED) — the sidecar detects
that exact terminal marker and answers 499 (the Node adapter has normally
already aborted its own fetch and reports "cancelled" itself).

Isolation guarantees this process enforces:

- Empty Toolkit: one Toolkit() is created and asserted empty at startup.
  Lane-C specified this assertion as `get_json_schemas() == []`; agentscope
  2.0.6 renamed that method to the async `get_tool_schemas()` — the startup
  assertion below is that same zero-tool assertion under its 2.0.6 name.
  No shell, file, code-execution, browser or MCP tool is registered or
  reachable. The MCP client library (a transitive agentscope dependency) is
  never imported by this file.
- No Motor volumes, no store port, no secrets. The only egress is the
  OpenAI-compatible Motor ModelPort (MODEL_PORT_URL, typically llama.cpp).
- Telemetry off: agentscope.init is NEVER called, so no OpenTelemetry
  tracing/Studio connection is set up (tracing is opt-in upstream).
  Compose additionally sets OTEL_SDK_DISABLED=true.
- No durable state: the in-flight registry below is volatile per-attempt
  cancellation bookkeeping, never a source of truth.
- Bodies are capped at 1 MiB in both directions; unknown paths get 404.

The sidecar never calls Motor tools or MCP directly; it is execution
mechanics behind the Motor CapabilityAdapter seam only.
"""

import asyncio
import concurrent.futures
import json
import os
import sys
import threading
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PROTOCOL_VERSION = "motor-sidecar/1"
MAX_BODY_BYTES = 1_048_576  # 1 MiB, phase-0 protocol cap

MODEL_PORT_URL = os.environ.get("MODEL_PORT_URL", "http://127.0.0.1:8080/v1")
MODEL_NAME = os.environ.get("MODEL_NAME", "Qwen3.6-35B-A3B-UD-Q4_K_XL")
MODEL_TIMEOUT_MS = int(os.environ.get("MODEL_TIMEOUT_MS", "110000"))
HEALTH_MODEL_TIMEOUT_S = 2.0
SIDECAR_PORT = int(os.environ.get("AGENTSCOPE_SIDECAR_PORT", "4410"))
# Inside a container the process must bind 0.0.0.0 or Docker cannot forward
# the published port; the loopback guarantee is then enforced by the host
# publish binding (127.0.0.1:4410 in compose.agentscope.yaml). Bare-metal
# default stays loopback.
SIDECAR_HOST = os.environ.get("AGENTSCOPE_SIDECAR_HOST", "127.0.0.1")


class AttemptCancelled(Exception):
    """Internal marker: the model call ended via asyncio cancellation."""


def build_model():
    """OpenAIChatModel bound exclusively to the Motor ModelPort.

    api_key is a non-empty placeholder: the local ModelPort (llama.cpp)
    ignores it. It is not a secret and never leaves this process.
    max_retries=0 at both the agentscope and the openai-client level:
    a hidden retry loop inside the sidecar is forbidden (phase 0) — retry
    belongs to the Motor engine.
    """
    from agentscope.credential import OpenAICredential
    from agentscope.model import OpenAIChatModel

    credential = OpenAICredential(
        api_key="motor-local-no-key",
        base_url=MODEL_PORT_URL,
    )
    return OpenAIChatModel(
        credential=credential,
        model=MODEL_NAME,
        stream=False,
        max_retries=0,
        parameters=OpenAIChatModel.Parameters(temperature=0.3, max_tokens=512),
        # Qwen on llama.cpp defaults to thinking mode: the whole token
        # budget then goes to reasoning_content and content stays empty
        # (measured live on 2026-08-15, P0.7). The openai client merges
        # extra_body into the request JSON body — the same field the
        # llamacpp Node adapter already sends. A body parameter, not new
        # egress.
        extra_body={"chat_template_kwargs": {"enable_thinking": False}},
        client_kwargs={
            "timeout": MODEL_TIMEOUT_MS / 1000.0,
            "max_retries": 0,
        },
    )


class ModelRuntime:
    """Owns the single asyncio loop (daemon thread) and the model client.

    The openai AsyncClient pools keep-alive connections; reusing it across
    per-request event loops breaks on closed loops. One long-lived loop on
    its own thread keeps every model call on the loop that owns the client.
    """

    def __init__(self):
        self._loop = asyncio.new_event_loop()
        self._started = threading.Event()
        self._model = None
        self._thread = threading.Thread(
            target=self._serve, name="model-loop", daemon=True
        )

    def start(self):
        self._thread.start()
        if not self._started.wait(timeout=10):
            raise RuntimeError("model loop thread failed to start")

    def _serve(self):
        asyncio.set_event_loop(self._loop)
        self._started.set()
        self._loop.run_forever()

    def alive(self):
        return self._thread.is_alive() and self._loop.is_running()

    def run_blocking(self, coro, timeout_s):
        """Startup helper: run one coroutine on the loop, wait for it."""
        return asyncio.run_coroutine_threadsafe(coro, self._loop).result(
            timeout=timeout_s
        )

    def submit(self, prompt):
        """Schedule one stateless generation; returns a concurrent Future.

        future.cancel() from any HTTP thread propagates into the asyncio
        task (run_coroutine_threadsafe chains cancellation); agentscope then
        ends the call with finished_reason=INTERRUPTED, which _generate maps
        to AttemptCancelled.
        """
        return asyncio.run_coroutine_threadsafe(
            self._generate(prompt), self._loop
        )

    async def _generate(self, prompt):
        from agentscope.message import Msg
        from agentscope.model import FinishedReason

        if self._model is None:
            self._model = build_model()
        message = Msg(
            name="user",
            role="user",
            content=[{"type": "text", "text": prompt}],
        )
        response = await self._model(messages=[message])
        if response.finished_reason == FinishedReason.INTERRUPTED:
            raise AttemptCancelled()
        # TextBlock only; ThinkingBlock content is deliberation, not output.
        return "".join(
            block.text
            for block in response.content
            if getattr(block, "type", None) == "text"
        )


class InFlight:
    """Volatile per-attempt cancel registry. Not state, not a store."""

    def __init__(self):
        self._lock = threading.Lock()
        self._entries = {}

    def register(self, attempt_id, future):
        with self._lock:
            if attempt_id in self._entries:
                return False
            self._entries[attempt_id] = future
            return True

    def unregister(self, attempt_id):
        with self._lock:
            self._entries.pop(attempt_id, None)

    def cancel(self, attempt_id):
        with self._lock:
            future = self._entries.get(attempt_id)
        if future is None:
            return False
        return future.cancel()


RUNTIME = ModelRuntime()
IN_FLIGHT = InFlight()


async def assert_empty_toolkit():
    """Startup assertion: zero tools registered, zero schemas exposed."""
    from agentscope.tool import Toolkit

    toolkit = Toolkit()
    schemas = await toolkit.get_tool_schemas()
    if schemas:
        raise RuntimeError(f"toolkit must be empty, got {len(schemas)} tools")
    return toolkit


def check_model_endpoint():
    """Bounded readiness probe of the Motor ModelPort (never cached)."""
    url = MODEL_PORT_URL.rstrip("/") + "/models"
    request = urllib.request.Request(url, method="GET")
    try:
        with urllib.request.urlopen(request, timeout=HEALTH_MODEL_TIMEOUT_S):
            return True
    except urllib.error.HTTPError:
        # Any HTTP status means TCP+HTTP reach the endpoint: reachable.
        return True
    except (urllib.error.URLError, OSError):
        return False


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "motor-agentscope-sidecar/1.0.0"

    def log_message(self, fmt, *args):  # noqa: A003 - stdlib name
        sys.stderr.write("sidecar: %s\n" % (fmt % args))

    def _send(self, status, payload):
        envelope = {"protocol": PROTOCOL_VERSION, **payload}
        body = json.dumps(envelope).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            # The adapter already aborted (timeout/cancel); late bytes are
            # discarded by the transport and must not crash the handler.
            pass

    def _read_json(self):
        length = self.headers.get("content-length")
        if length is None:
            return None, 411
        try:
            n = int(length)
        except ValueError:
            return None, 400
        if n > MAX_BODY_BYTES:
            return None, 413
        raw = self.rfile.read(n)
        try:
            return json.loads(raw.decode("utf-8")), None
        except (ValueError, UnicodeDecodeError):
            return None, 400

    def do_GET(self):  # noqa: N802 - stdlib name
        if self.path == "/health":
            loop_alive = RUNTIME.alive()
            model_reachable = loop_alive and check_model_endpoint()
            if not loop_alive:
                status = "down"
            elif not model_reachable:
                status = "degraded"
            else:
                status = "ok"
            self._send(
                200,
                {
                    "status": status,
                    "checks": {
                        "model_loop": "alive" if loop_alive else "dead",
                        "model_endpoint": (
                            "reachable" if model_reachable else "unreachable"
                        ),
                    },
                },
            )
        else:
            self._send(404, {"error": "not_found"})

    def do_POST(self):  # noqa: N802 - stdlib name
        if self.path == "/invoke":
            self._handle_invoke()
        elif self.path == "/cancel":
            self._handle_cancel()
        else:
            self._send(404, {"error": "not_found"})

    def _handle_invoke(self):
        body, error_status = self._read_json()
        if error_status is not None:
            self._send(error_status, {"error": "bad_request"})
            return
        task_id = body.get("task_id")
        run_id = body.get("run_id")
        attempt_id = body.get("attempt_id")
        prompt = body.get("input")
        if not all(
            isinstance(v, str) and v for v in (task_id, run_id, attempt_id)
        ) or not isinstance(prompt, str):
            self._send(400, {"error": "missing_or_invalid_fields"})
            return

        future = RUNTIME.submit(prompt)
        if not IN_FLIGHT.register(attempt_id, future):
            future.cancel()
            self._send(409, {"error": "attempt_id_already_in_flight"})
            return
        try:
            # Backstop slightly beyond the model-client timeout so the honest
            # model error (APITimeoutError -> 504) normally wins the race.
            output = future.result(timeout=MODEL_TIMEOUT_MS / 1000.0 + 5.0)
        except (concurrent.futures.CancelledError, AttemptCancelled):
            # The adapter already aborted its fetch via cancel(); this
            # response is defense-in-depth and normally never read.
            self._send(499, {"error": "cancelled", "attempt_id": attempt_id})
            return
        except concurrent.futures.TimeoutError:
            IN_FLIGHT.cancel(attempt_id)
            self._send(504, {"error": "model_timeout_backstop"})
            return
        except Exception as exc:  # model/transport failure
            name = type(exc).__name__
            if name in ("APITimeoutError", "TimeoutError"):
                self._send(504, {"error": "model_timeout"})
            else:
                self._send(502, {"error": f"model_unavailable: {name}"[:200]})
            return
        finally:
            IN_FLIGHT.unregister(attempt_id)

        if not output:
            self._send(502, {"error": "empty_model_output"})
            return
        if len(output.encode("utf-8")) > MAX_BODY_BYTES:
            self._send(502, {"error": "output_exceeds_protocol_cap"})
            return
        # Exact causal-id echo: the Node adapter verifies these and fails
        # closed as causal_mismatch on any difference.
        self._send(
            200,
            {
                "output": output,
                "task_id": task_id,
                "run_id": run_id,
                "attempt_id": attempt_id,
            },
        )

    def _handle_cancel(self):
        body, error_status = self._read_json()
        if error_status is not None:
            self._send(error_status, {"error": "bad_request"})
            return
        attempt_id = body.get("attempt_id")
        if not isinstance(attempt_id, str) or not attempt_id:
            self._send(400, {"error": "missing_or_invalid_fields"})
            return
        self._send(200, {"cancelled": IN_FLIGHT.cancel(attempt_id)})


def main():
    RUNTIME.start()
    # Startup assertion (lane-C invariant): the Toolkit is provably empty.
    # Never passed to the model, never reachable via HTTP.
    RUNTIME.run_blocking(assert_empty_toolkit(), timeout_s=30)
    server = ThreadingHTTPServer((SIDECAR_HOST, SIDECAR_PORT), Handler)
    server.daemon_threads = True
    sys.stderr.write(
        "sidecar: listening on %s:%d, protocol=%s, model=%s, toolkit empty, "
        "telemetry disabled (agentscope.init never called)\n"
        % (SIDECAR_HOST, SIDECAR_PORT, PROTOCOL_VERSION, MODEL_NAME)
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
