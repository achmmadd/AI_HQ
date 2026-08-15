"""Fake OpenAI-compatible modelendpoint — uitsluitend voor tests en smokes.

Draait een minimaal in-proces HTTP-servertje dat `GET /v1/models` en
`POST /v1/chat/completions` beantwoordt met volledig synthetische antwoorden.
Nooit een echt model, nooit een echte endpoint, nooit echte data. De
hermes-sidecar kan hier in CI/containers tegenaan draaien zonder egress.

Gedragsknoppen via de omgeving (allemaal fictief/lokaal):

    FAKE_MODEL_PORT       luisterpoort (default 8080)
    FAKE_MODEL_SLEEP_MS   vertraging vóór het completions-antwoord; zo
                          bewijzen timeout- en cancel-smokes hun grens
    FAKE_MODEL_MODE       "ok" (default) | "malformed" (kapotte JSON terug)
"""

from __future__ import annotations

import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class FakeModelHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    server_version = "fake-model/0.1.0"

    def _send(self, status: int, raw: bytes) -> None:
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _sleep_if_configured(self) -> None:
        sleep_ms = int(os.environ.get("FAKE_MODEL_SLEEP_MS", "0"))
        if sleep_ms > 0:
            time.sleep(sleep_ms / 1000.0)

    def do_GET(self) -> None:  # noqa: N802 (http.server-API)
        if self.path == "/v1/models":
            self._send(200, json.dumps({"data": [{"id": "fake-model"}]}).encode())
        else:
            self._send(404, json.dumps({"error": "not_found"}).encode())

    def do_POST(self) -> None:  # noqa: N802 (http.server-API)
        if self.path != "/v1/chat/completions":
            self._send(404, json.dumps({"error": "not_found"}).encode())
            return
        length = int(self.headers.get("Content-Length", "0"))
        prompt = ""
        try:
            parsed = json.loads(self.rfile.read(length))
            messages = parsed.get("messages", [])
            if messages and isinstance(messages[-1], dict):
                prompt = str(messages[-1].get("content", ""))
        except (json.JSONDecodeError, ValueError):
            pass
        self._sleep_if_configured()
        if os.environ.get("FAKE_MODEL_MODE", "ok") == "malformed":
            self._send(200, b'{"choices": ')  # bewust kapotte JSON
            return
        output = f"fake-draft: {prompt[:40]}"
        self._send(
            200,
            json.dumps(
                {
                    "choices": [
                        {
                            "index": 0,
                            "message": {"role": "assistant", "content": output},
                            "finish_reason": "stop",
                        }
                    ]
                }
            ).encode(),
        )

    def log_message(self, *_args: object) -> None:
        pass  # stil: smokelogs moeten alleen het bewijs tonen


def main() -> None:
    port = int(os.environ.get("FAKE_MODEL_PORT", "8080"))
    server = ThreadingHTTPServer(("0.0.0.0", port), FakeModelHandler)
    server.daemon_threads = True
    print(f"fake-model luistert op 0.0.0.0:{port} (synthetisch, geen echt model)",
          flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
