#!/usr/bin/env python3
"""agentscope-sidecar — Motor pilot sidecar (integration sprint, lane C).

Speaks exactly the phase-0 sidecar protocol over loopback HTTP/JSON:

    GET  /health  -> {"status": "ok" | "degraded" | "down"}      (<= 5 s)
    POST /invoke  -> {"task_id", "run_id", "attempt_id", "input"}
                  -> {"output", "task_id", "run_id", "attempt_id"} (echo!)
    POST /cancel  -> {"attempt_id"} -> {"cancelled": bool}

Isolation guarantees this process enforces:

- Empty Toolkit: one Toolkit() is created, asserted empty at startup and
  never passed anywhere. No shell, file, code-execution, browser or MCP
  tool is registered or reachable. The MCP client library (a transitive
  agentscope dependency) is never imported here.
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
import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

MAX_BODY_BYTES = 1_048_576  # 1 MiB, phase-0 protocol cap

MODEL_PORT_URL = os.environ.get("MODEL_PORT_URL", "http://127.0.0.1:8080/v1")
MODEL_NAME = os.environ.get("MODEL_NAME", "Qwen3.6-35B-A3B-UD-Q4_K_XL")
MODEL_TIMEOUT_MS = int(os.environ.get("MODEL_TIMEOUT_MS", "110000"))
SIDECAR_PORT = int(os.environ.get("AGENTSCOPE_SIDECAR_PORT", "4410"))
# Inside a container the process must bind 0.0.0.0 or Docker cannot forward
# the published port; the loopback guarantee is then enforced by the host
# publish binding (127.0.0.1:4410 in compose.agentscope.yaml). Bare-metal
# default stays loopback.
SIDECAR_HOST = os.environ.get("AGENTSCOPE_SIDECAR_HOST", "127.0.0.1")


def build_model():
    """OpenAIChatModel bound exclusively to the Motor ModelPort.

    api_key is a non-empty placeholder: the local ModelPort (llama.cpp)
    ignores it. It is not a secret and never leaves this process.
    """
    from agentscope.model import OpenAIChatModel

    return OpenAIChatModel(
        model_name=MODEL_NAME,
        api_key="motor-local-no-key",
        stream=False,
        client_kwargs={
            "base_url": MODEL_PORT_URL,
            "timeout": MODEL_TIMEOUT_MS / 1000.0,
        },
        generate_kwargs={"temperature": 0.3, "max_tokens": 512},
    )


def build_empty_toolkit():
    """A demonstrably empty Toolkit: zero registered functions at startup."""
    from agentscope.tool import Toolkit

    toolkit = Toolkit()
    schemas = toolkit.get_json_schemas()
    if schemas:
        raise RuntimeError(f"toolkit must be empty, got {len(schemas)} tools")
    return toolkit


class InFlight:
    """Volatile per-attempt cancel registry. Not state, not a store."""

    def __init__(self):
        self._lock = threading.Lock()
        self._entries = {}

    def register(self, attempt_id, loop, task):
        with self._lock:
            self._entries[attempt_id] = (loop, task)

    def unregister(self, attempt_id):
        with self._lock:
            self._entries.pop(attempt_id, None)

    def cancel(self, attempt_id):
        with self._lock:
            entry = self._entries.get(attempt_id)
        if entry is None:
            return False
        loop, task = entry
        loop.call_soon_threadsafe(task.cancel)
        return True


IN_FLIGHT = InFlight()
MODEL = None  # lazily built on first invoke so /health works without a model


def get_model():
    global MODEL
    if MODEL is None:
        MODEL = build_model()
    return MODEL


async def generate(prompt):
    """One stateless model call. No tools, no memory, no retry — the Motor
    engine owns retry; a cancelled task propagates as CancelledError."""
    response = await get_model()(messages=[{"role": "user", "content": prompt}])
    parts = []
    for block in response.content or []:
        # TextBlock only; ThinkingBlock content is deliberation, not output.
        if hasattr(block, "get") and block.get("type") == "text":
            parts.append(block.get("text", ""))
    return "".join(parts)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "motor-agentscope-sidecar/0.1.0"

    def log_message(self, fmt, *args):  # noqa: A003 - stdlib name
        sys.stderr.write("sidecar: %s\n" % (fmt % args))

    def _send(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

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
            # "ok" = protocol serving. Model reachability is proven by the
            # first real invoke; the adapter maps transport failure itself.
            self._send(200, {"status": "ok"})
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

        loop = asyncio.new_event_loop()
        try:
            task = loop.create_task(generate(prompt))
            IN_FLIGHT.register(attempt_id, loop, task)
            try:
                output = loop.run_until_complete(task)
            except asyncio.CancelledError:
                # The adapter already aborted its fetch via cancel(); this
                # response is defense-in-depth and normally never read.
                self._send(499, {"error": "cancelled"})
                return
            except Exception as exc:  # model/transport failure
                self._send(502, {"error": f"model_unavailable: {exc}"[:200]})
                return
        finally:
            IN_FLIGHT.unregister(attempt_id)
            loop.close()

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
    toolkit = build_empty_toolkit()  # startup assertion: zero tools
    del toolkit  # never passed to the model, never reachable via HTTP
    server = ThreadingHTTPServer((SIDECAR_HOST, SIDECAR_PORT), Handler)
    server.daemon_threads = True
    sys.stderr.write(
        "sidecar: listening on %s:%d, model=%s, toolkit empty, "
        "telemetry disabled (no agentscope.init)\n"
        % (SIDECAR_HOST, SIDECAR_PORT, MODEL_NAME)
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
