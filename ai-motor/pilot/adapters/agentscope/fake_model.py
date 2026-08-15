#!/usr/bin/env python3
"""fake-model — deterministic OpenAI-compatible stub for Motor pilot tests.

NEVER a real model and never the real RTX endpoint: this stub exists so the
AgentScope sidecar can be exercised end-to-end in tests/CI without real
inference. Standard library only, no agentscope import, no state, no disk,
no secrets, no egress.

Endpoints (the only two the sidecar/model stack uses):

    GET  /v1/models            -> static list (readiness probe target)
    POST /v1/chat/completions  -> synthetic completion echoing the last
                                  user message ("synthetic draft: <prompt>")

Test knobs (env):

    FAKE_MODEL_PORT      listen port (default 8811)
    FAKE_MODEL_DELAY_MS  fixed delay before each completion (timeout evidence)
    FAKE_MODEL_HANG      "1" = never answer completions (cancel evidence)
"""

import json
import os
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("FAKE_MODEL_PORT", "8811"))
DELAY_MS = int(os.environ.get("FAKE_MODEL_DELAY_MS", "0"))
HANG = os.environ.get("FAKE_MODEL_HANG", "0") == "1"

MAX_BODY_BYTES = 1_048_576


def extract_prompt(body):
    """Last user message text, from both plain-string and block-list content."""
    messages = body.get("messages")
    if not isinstance(messages, list):
        return ""
    for message in reversed(messages):
        if not isinstance(message, dict) or message.get("role") != "user":
            continue
        content = message.get("content")
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            return "".join(
                part.get("text", "")
                for part in content
                if isinstance(part, dict) and part.get("type") == "text"
            )
    return ""


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "motor-fake-model/1.0"

    def log_message(self, fmt, *args):  # noqa: A003 - stdlib name
        sys.stderr.write("fake-model: %s\n" % (fmt % args))

    def _send(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("content-type", "application/json")
            self.send_header("content-length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_GET(self):  # noqa: N802 - stdlib name
        if self.path == "/v1/models":
            self._send(
                200,
                {
                    "object": "list",
                    "data": [
                        {
                            "id": "motor-fake-model",
                            "object": "model",
                            "created": 0,
                            "owned_by": "motor-pilot-fake",
                        }
                    ],
                },
            )
        else:
            self._send(404, {"error": "not_found"})

    def do_POST(self):  # noqa: N802 - stdlib name
        if self.path != "/v1/chat/completions":
            self._send(404, {"error": "not_found"})
            return
        length = self.headers.get("content-length")
        if length is None:
            self._send(411, {"error": "length_required"})
            return
        n = int(length)
        if n > MAX_BODY_BYTES:
            self._send(413, {"error": "too_large"})
            return
        try:
            body = json.loads(self.rfile.read(n).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            self._send(400, {"error": "bad_json"})
            return
        if HANG:
            # Never answer: only a client-side cancel/timeout ends the call.
            # The event lets the main thread keep serving other requests.
            threading.Event().wait()
            return
        if DELAY_MS > 0:
            time.sleep(DELAY_MS / 1000.0)
        self._send(
            200,
            {
                "id": "chatcmpl-fake-0001",
                "object": "chat.completion",
                "created": 1766000000,
                "model": body.get("model", "motor-fake-model"),
                "choices": [
                    {
                        "index": 0,
                        "message": {
                            "role": "assistant",
                            "content": "synthetic draft: " + extract_prompt(body),
                        },
                        "finish_reason": "stop",
                    }
                ],
                "usage": {
                    "prompt_tokens": 1,
                    "completion_tokens": 2,
                    "total_tokens": 3,
                },
            },
        )


def main():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    server.daemon_threads = True
    sys.stderr.write(
        "fake-model: listening on 0.0.0.0:%d delay_ms=%d hang=%s\n"
        % (PORT, DELAY_MS, HANG)
    )
    server.serve_forever()


if __name__ == "__main__":
    main()
