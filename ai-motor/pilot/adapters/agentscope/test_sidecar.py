#!/usr/bin/env python3
"""Tests for the activated AgentScope sidecar (P0.7 live-smoke lane).

Runs the REAL sidecar stack (agentscope 2.0.6 + openai client) against an
in-process stdlib capture endpoint on 127.0.0.1 — no real model, no real
RTX, no egress beyond loopback. Proves the P0.7 fix: the outgoing
chat.completions request body carries
``chat_template_kwargs: {"enable_thinking": False}`` so Qwen on llama.cpp
does not answer with empty ``content`` (all tokens burned on
``reasoning_content`` — measured live on 2026-08-15).

Where ``agentscope`` is not importable the test cannot exercise the real
stack: it SKIPs with an explicit reason (same convention as the lane-D
conformance suite). Where the package IS present the test MUST run — a
failure is never silently downgraded.

Run: python3 -m unittest test_sidecar -v   (from pilot/adapters/agentscope/)
"""

import http.server
import json
import os
import socket
import threading
import unittest
import urllib.request


def _unused_port():
    """A just-released loopback port: virtually certain to be free."""
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


# sidecar.py binds its configuration from the environment at import time,
# so the capture-endpoint URL must be in place BEFORE the import.
_CAPTURE_PORT = _unused_port()
os.environ["MODEL_PORT_URL"] = f"http://127.0.0.1:{_CAPTURE_PORT}/v1"
os.environ["MODEL_NAME"] = "motor-capture-model"
os.environ["OTEL_SDK_DISABLED"] = "true"

try:
    import agentscope  # noqa: F401

    HAVE_AGENTSCOPE = True
except ImportError:
    HAVE_AGENTSCOPE = False

import sidecar  # noqa: E402  (env must precede this import)


def _chat_completion(prompt_echo):
    return json.dumps(
        {
            "id": "chatcmpl-capture-0001",
            "object": "chat.completion",
            "created": 1766000000,
            "model": "motor-capture-model",
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": "capture-draft: " + prompt_echo,
                    },
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 1,
                "completion_tokens": 2,
                "total_tokens": 3,
            },
        }
    ).encode("utf-8")


class CaptureEndpoint:
    """In-process OpenAI-compatible stub that RECORDS request bodies."""

    def __init__(self, port):
        self.requests = []
        outer = self

        class Handler(http.server.BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def _send(self, status, raw):
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

            def do_GET(self):  # noqa: N802
                if self.path == "/v1/models":
                    self._send(
                        200,
                        json.dumps(
                            {
                                "object": "list",
                                "data": [
                                    {
                                        "id": "motor-capture-model",
                                        "object": "model",
                                        "created": 0,
                                        "owned_by": "motor-pilot-capture",
                                    }
                                ],
                            }
                        ).encode("utf-8"),
                    )
                else:
                    self._send(404, b"{}")

            def do_POST(self):  # noqa: N802
                length = int(self.headers.get("Content-Length", "0"))
                raw = self.rfile.read(length)
                try:
                    outer.requests.append(json.loads(raw.decode("utf-8")))
                except (ValueError, UnicodeDecodeError):
                    outer.requests.append({})
                if self.path == "/v1/chat/completions":
                    prompt = ""
                    messages = outer.requests[-1].get("messages") or []
                    for message in reversed(messages):
                        if message.get("role") == "user":
                            content = message.get("content")
                            if isinstance(content, str):
                                prompt = content
                            elif isinstance(content, list):
                                prompt = "".join(
                                    part.get("text", "")
                                    for part in content
                                    if isinstance(part, dict)
                                    and part.get("type") == "text"
                                )
                            break
                    self._send(200, _chat_completion(prompt))
                else:
                    self._send(404, b"{}")

            def log_message(self, *_args):
                pass

        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", port), Handler)
        self.server.daemon_threads = True
        self.thread = threading.Thread(
            target=self.server.serve_forever, daemon=True
        )
        self.thread.start()

    def stop(self):
        self.server.shutdown()
        self.server.server_close()


@unittest.skipUnless(
    HAVE_AGENTSCOPE,
    "agentscope package not installed here — real-stack body assertion "
    "runs in the hash-locked sidecar image on the builder",
)
class TestThinkingModeBody(unittest.TestCase):
    """End-to-end: /invoke -> agentscope 2.0.6 -> openai client -> body."""

    @classmethod
    def setUpClass(cls):
        cls.endpoint = CaptureEndpoint(_CAPTURE_PORT)
        cls.addClassCleanup(cls.endpoint.stop)
        sidecar.RUNTIME.start()
        cls.addClassCleanup(sidecar.RUNTIME._loop.call_soon_threadsafe,
                            sidecar.RUNTIME._loop.stop)
        cls.server = http.server.ThreadingHTTPServer(
            ("127.0.0.1", 0), sidecar.Handler
        )
        cls.server.daemon_threads = True
        cls.thread = threading.Thread(
            target=cls.server.serve_forever, daemon=True
        )
        cls.thread.start()
        cls.addClassCleanup(cls._stop_server)

    @classmethod
    def _stop_server(cls):
        cls.server.shutdown()
        cls.server.server_close()

    @property
    def url(self):
        return f"http://127.0.0.1:{self.server.server_address[1]}"

    def _post(self, path, payload):
        data = json.dumps(payload).encode("utf-8")
        request = urllib.request.Request(
            self.url + path, data=data, method="POST"
        )
        request.add_header("content-type", "application/json")
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read())

    def test_build_model_carries_enable_thinking_extra_body(self):
        model = sidecar.build_model()
        self.assertEqual(
            model.extra_body,
            {"chat_template_kwargs": {"enable_thinking": False}},
        )

    def test_invoke_request_body_disables_thinking_mode(self):
        status, body = self._post(
            "/invoke",
            {
                "task_id": "task-p07-body",
                "run_id": "run-p07-body",
                "attempt_id": "att-p07-body",
                "input": "synthetische body-assertie",
            },
        )
        self.assertEqual(status, 200)
        self.assertEqual(body["protocol"], "motor-sidecar/1")
        self.assertEqual(
            body["output"], "capture-draft: synthetische body-assertie"
        )
        self.assertEqual(body["task_id"], "task-p07-body")
        self.assertEqual(body["run_id"], "run-p07-body")
        self.assertEqual(body["attempt_id"], "att-p07-body")
        # The core P0.7 assertion: the field reached the wire verbatim.
        sent = self.endpoint.requests[-1]
        self.assertEqual(
            sent.get("chat_template_kwargs"), {"enable_thinking": False}
        )
        self.assertEqual(sent.get("model"), "motor-capture-model")
        self.assertEqual(sent.get("stream"), False)


if __name__ == "__main__":
    unittest.main()
