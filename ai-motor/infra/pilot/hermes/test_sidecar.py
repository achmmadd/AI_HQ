"""Tests voor de bedraade hermes-sidecar — uitsluitend stdlib (unittest).

Draait de sidecar én een gescript fake-modelendpoint in-proces op
127.0.0.1 met ephemeral poorten: nul externe netwerk-I/O, nul echte
endpoints, nul echte data. De tests bewijzen dat elke terminale failure
(timeout, cancel, unavailable, malformed response) gecontroleerd eindigt
in de HTTP-vorm die de Node-adapter op de fase-0-fouttaxonomie mapt:

    503/504 -> unavailable (retryable) · 422 -> malformed_response (terminaal)
    200 {"cancelled": true}            -> gecontroleerde cancel-afsluiting

Draaien: python3 -m unittest test_sidecar -v  (vanuit infra/pilot/hermes/)
"""

from __future__ import annotations

import http.server
import json
import threading
import time
import unittest
import urllib.error
import urllib.request

import sidecar

PROTOCOL = "motor-sidecar/1"
IDS = {"task_id": "task-1", "run_id": "run-1", "attempt_id": "att-1"}


def _chat_completion(content: str) -> bytes:
    return json.dumps(
        {
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": content},
                    "finish_reason": "stop",
                }
            ]
        }
    ).encode("utf-8")


class FakeModel:
    """Gescript in-proces OpenAI-compatible endpoint (loopback-only)."""

    def __init__(self) -> None:
        self.mode = "ok"  # ok | slow | bad_json | no_choices | empty |
        # non_string | http_500 | http_429 | http_400 | oversized
        self.slow_s = 5.0
        self.requests: list[dict] = []

        outer = self

        class Handler(http.server.BaseHTTPRequestHandler):
            protocol_version = "HTTP/1.1"

            def _send(self, status: int, raw: bytes, lie_length: int = 0) -> None:
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                declared = lie_length if lie_length > 0 else len(raw)
                self.send_header("Content-Length", str(declared))
                self.end_headers()
                self.wfile.write(raw)

            def do_GET(self) -> None:  # noqa: N802
                if self.path == "/v1/models":
                    self._send(200, json.dumps({"data": [{"id": "fake"}]}).encode())
                else:
                    self._send(404, b"{}")

            def do_POST(self) -> None:  # noqa: N802
                length = int(self.headers.get("Content-Length", "0"))
                raw = self.rfile.read(length)
                try:
                    outer.requests.append(json.loads(raw))
                except json.JSONDecodeError:
                    outer.requests.append({})
                mode = outer.mode
                if mode == "slow":
                    time.sleep(outer.slow_s)
                    self._send(200, _chat_completion("te laat"))
                elif mode == "bad_json":
                    self._send(200, b'{"choices": ')
                elif mode == "no_choices":
                    self._send(200, json.dumps({"choices": []}).encode())
                elif mode == "empty":
                    self._send(200, _chat_completion(""))
                elif mode == "non_string":
                    self._send(
                        200,
                        json.dumps({"choices": [{"message": {"content": 42}}]}).encode(),
                    )
                elif mode == "http_500":
                    self._send(500, b'{"error": "boom"}')
                elif mode == "http_429":
                    self._send(429, b'{"error": "slow down"}')
                elif mode == "http_400":
                    self._send(400, b'{"error": "unknown model"}')
                elif mode == "oversized":
                    self._send(200, b" ", lie_length=sidecar.PROTOCOL_MAX_BODY_BYTES + 1)
                else:
                    self._send(200, _chat_completion(f"fake-draft voor {len(raw)} bytes"))

            def log_message(self, *_args: object) -> None:
                pass

        self.server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.server.daemon_threads = True
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.server.server_address[1]}/v1"

    def stop(self) -> None:
        self.server.shutdown()
        self.server.server_close()


def _unused_port() -> int:
    """Een zojuist vrijgekomen loopback-poort: vrijwel zeker gesloten."""
    import socket

    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def _request(method: str, url: str, payload: dict | None = None) -> tuple[int, dict]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, method=method)
    if data is not None:
        req.add_header("content-type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read())


class SidecarTestCase(unittest.TestCase):
    """Start per test een echte SidecarServer op een ephemeral loopback-poort."""

    def start_sidecar(self, config: sidecar.SidecarConfig) -> None:
        self.server = sidecar.SidecarServer(("127.0.0.1", 0), config)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self._stop)

    def _stop(self) -> None:
        self.server.shutdown()
        self.server.server_close()

    @property
    def url(self) -> str:
        return f"http://127.0.0.1:{self.server.server_address[1]}"

    def config_for(self, model_base: str | None, timeout_s: float = 5.0) -> sidecar.SidecarConfig:
        return sidecar.SidecarConfig(
            model_port_url=model_base,
            model_name="fake-model",
            model_timeout_s=timeout_s,
        )


class TestHealth(SidecarTestCase):
    def test_health_ok_when_model_reachable(self) -> None:
        model = FakeModel()
        self.addCleanup(model.stop)
        self.start_sidecar(self.config_for(model.base_url))
        status, body = _request("GET", f"{self.url}/health")
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "ok")
        self.assertEqual(body["protocol"], PROTOCOL)

    def test_health_degraded_when_model_unreachable(self) -> None:
        self.start_sidecar(self.config_for(f"http://127.0.0.1:{_unused_port()}/v1"))
        status, body = _request("GET", f"{self.url}/health")
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "degraded")
        self.assertEqual(body["protocol"], PROTOCOL)

    def test_health_degraded_when_model_unconfigured(self) -> None:
        self.start_sidecar(self.config_for(None))
        status, body = _request("GET", f"{self.url}/health")
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "degraded")


class TestInvokeHappy(SidecarTestCase):
    def test_invoke_returns_output_and_exact_causal_echo(self) -> None:
        model = FakeModel()
        self.addCleanup(model.stop)
        self.start_sidecar(self.config_for(model.base_url))
        status, body = _request(
            "POST", f"{self.url}/invoke", {**IDS, "input": "Schrijf een korte opvolgmail"}
        )
        self.assertEqual(status, 200)
        self.assertEqual(body["protocol"], PROTOCOL)
        self.assertTrue(body["output"].startswith("fake-draft"))
        # Exacte echo van de drie causale id's — de Node-adapter verifieert dit.
        for key, value in IDS.items():
            self.assertEqual(body[key], value)
        # Het model kreeg een OpenAI-compatible chat.completions-body.
        sent = model.requests[0]
        self.assertEqual(sent["model"], "fake-model")
        self.assertEqual(sent["messages"][0]["role"], "user")
        self.assertEqual(sent["messages"][0]["content"], "Schrijf een korte opvolgmail")
        self.assertEqual(sent.get("stream"), False)

    def test_invoke_disables_thinking_mode_in_model_body(self) -> None:
        # P0.7-les: Qwen op llama.cpp denkt standaard "na" in
        # reasoning_content en laat content leeg. De sidecar MOET
        # enable_thinking=false in de request-body sturen.
        model = FakeModel()
        self.addCleanup(model.stop)
        self.start_sidecar(self.config_for(model.base_url))
        status, body = _request(
            "POST", f"{self.url}/invoke", {**IDS, "input": "x"}
        )
        self.assertEqual(status, 200)
        self.assertIn("output", body)
        sent = model.requests[0]
        self.assertEqual(
            sent.get("chat_template_kwargs"), {"enable_thinking": False}
        )

    def test_protocol_version_on_every_answer_including_404(self) -> None:
        self.start_sidecar(self.config_for(None))
        for method, path, payload in (
            ("GET", "/health", None),
            ("GET", "/nope", None),
            ("POST", "/nope", {}),
            ("POST", "/invoke", {}),
            ("POST", "/cancel", {}),
        ):
            status, body = _request(method, f"{self.url}{path}", payload)
            self.assertEqual(
                body.get("protocol"), PROTOCOL, f"{method} {path} (HTTP {status})"
            )


class TestInvokeValidation(SidecarTestCase):
    def setUp(self) -> None:
        self.start_sidecar(self.config_for(None))

    def test_missing_fields_is_400(self) -> None:
        status, body = _request("POST", f"{self.url}/invoke", {"task_id": "x"})
        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "task_id_run_id_attempt_id_and_input_required")

    def test_non_string_input_is_400(self) -> None:
        status, body = _request("POST", f"{self.url}/invoke", {**IDS, "input": 42})
        self.assertEqual(status, 400)

    def test_invalid_json_is_400(self) -> None:
        req = urllib.request.Request(
            f"{self.url}/invoke", data=b"{kapot", method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=5):
                self.fail("verwachtte HTTP 400")
        except urllib.error.HTTPError as exc:
            self.assertEqual(exc.code, 400)
            self.assertEqual(json.loads(exc.read())["error"], "invalid_json")

    def test_oversized_request_is_413_without_model_call(self) -> None:
        req = urllib.request.Request(
            f"{self.url}/invoke",
            data=b" ",
            method="POST",
        )
        req.add_header("content-type", "application/json")
        # Lieg over de lengte boven de protocolgrens; de server weigert vóór read.
        req.add_header("content-length", str(sidecar.PROTOCOL_MAX_BODY_BYTES + 1))
        try:
            with urllib.request.urlopen(req, timeout=5):
                self.fail("verwachtte HTTP 413")
        except urllib.error.HTTPError as exc:
            self.assertEqual(exc.code, 413)
            self.assertEqual(
                json.loads(exc.read())["error"], "body_exceeds_protocol_bound"
            )

    def test_cancel_requires_attempt_id(self) -> None:
        status, body = _request("POST", f"{self.url}/cancel", {})
        self.assertEqual(status, 400)
        self.assertEqual(body["error"], "attempt_id_required")


class TestFailureTaxonomy(SidecarTestCase):
    """Elke failure eindigt gecontroleerd: de HTTP-vorm die de Node-adapter
    exact één-op-één op de fase-0-taxonomie mapt."""

    def test_unavailable_when_model_endpoint_down(self) -> None:
        self.start_sidecar(self.config_for(f"http://127.0.0.1:{_unused_port()}/v1"))
        status, body = _request("POST", f"{self.url}/invoke", {**IDS, "input": "x"})
        self.assertEqual(status, 503)  # adapter: unavailable (retryable)
        self.assertEqual(body["error"], "model_unavailable")
        for key, value in IDS.items():
            self.assertEqual(body[key], value)

    def test_unavailable_when_model_unconfigured(self) -> None:
        self.start_sidecar(self.config_for(None))
        status, body = _request("POST", f"{self.url}/invoke", {**IDS, "input": "x"})
        self.assertEqual(status, 503)
        self.assertEqual(body["error"], "model_unavailable")

    def test_unavailable_on_model_5xx_and_429(self) -> None:
        model = FakeModel()
        self.addCleanup(model.stop)
        self.start_sidecar(self.config_for(model.base_url))
        for mode in ("http_500", "http_429"):
            model.mode = mode
            status, body = _request("POST", f"{self.url}/invoke", {**IDS, "input": "x"})
            self.assertEqual(status, 503, mode)  # adapter: unavailable (retryable)
            self.assertEqual(body["error"], "model_unavailable")

    def test_timeout_is_bounded_and_controlled(self) -> None:
        model = FakeModel()
        self.addCleanup(model.stop)
        model.mode = "slow"
        model.slow_s = 30.0  # veel langer dan de sidecar-grens
        self.start_sidecar(self.config_for(model.base_url, timeout_s=1.0))
        started = time.monotonic()
        status, body = _request("POST", f"{self.url}/invoke", {**IDS, "input": "x"})
        elapsed = time.monotonic() - started
        self.assertEqual(status, 504)  # adapter: unavailable (retryable)
        self.assertEqual(body["error"], "model_timeout")
        self.assertLess(elapsed, 10.0)  # gecontroleerd: nooit de 30 s van het model
        for key, value in IDS.items():
            self.assertEqual(body[key], value)

    def test_malformed_model_answers_are_denied_terminally(self) -> None:
        model = FakeModel()
        self.addCleanup(model.stop)
        self.start_sidecar(self.config_for(model.base_url))
        for mode in ("bad_json", "no_choices", "empty", "non_string", "http_400", "oversized"):
            model.mode = mode
            status, body = _request("POST", f"{self.url}/invoke", {**IDS, "input": "x"})
            self.assertEqual(status, 422, mode)  # adapter: malformed_response (terminaal)
            self.assertEqual(body["error"], "model_malformed_response", mode)
            for key, value in IDS.items():
                self.assertEqual(body[key], value, mode)


class TestCancel(SidecarTestCase):
    def test_cancel_unknown_attempt_is_false(self) -> None:
        self.start_sidecar(self.config_for(None))
        status, body = _request("POST", f"{self.url}/cancel", {"attempt_id": "att-onbekend"})
        self.assertEqual(status, 200)
        self.assertEqual(body["cancelled"], False)
        self.assertEqual(body["protocol"], PROTOCOL)

    def test_cancel_aborts_in_flight_invoke_promptly(self) -> None:
        model = FakeModel()
        self.addCleanup(model.stop)
        model.mode = "slow"
        model.slow_s = 30.0
        self.start_sidecar(self.config_for(model.base_url, timeout_s=30.0))

        outcome: list[tuple[int, dict]] = []

        def do_invoke() -> None:
            outcome.append(
                _request("POST", f"{self.url}/invoke", {**IDS, "input": "langdurig"})
            )

        invoke_thread = threading.Thread(target=do_invoke, daemon=True)
        started = time.monotonic()
        invoke_thread.start()
        time.sleep(0.5)  # laat de invoke echt in-flight raken

        status, body = _request("POST", f"{self.url}/cancel", {"attempt_id": IDS["attempt_id"]})
        self.assertEqual(status, 200)
        self.assertEqual(body["cancelled"], True)

        invoke_thread.join(timeout=10.0)
        elapsed = time.monotonic() - started
        self.assertFalse(invoke_thread.is_alive(), "invoke bleef hangen na cancel")
        self.assertLess(elapsed, 10.0)  # niet de 30 s van het trage model
        invoke_status, invoke_body = outcome[0]
        self.assertEqual(invoke_status, 200)
        self.assertEqual(invoke_body["cancelled"], True)
        for key, value in IDS.items():
            self.assertEqual(invoke_body[key], value)

    def test_registry_is_empty_after_invoke(self) -> None:
        model = FakeModel()
        self.addCleanup(model.stop)
        self.start_sidecar(self.config_for(model.base_url))
        _request("POST", f"{self.url}/invoke", {**IDS, "input": "x"})
        with sidecar._IN_FLIGHT_LOCK:
            self.assertEqual(len(sidecar._IN_FLIGHT), 0)


class TestConfig(unittest.TestCase):
    """Config uit de omgeving; de sidecar start ook zonder geldige URL."""

    def test_load_config_defaults_and_bounds(self) -> None:
        config = sidecar.load_config({})
        self.assertIsNone(config.model_port_url)
        self.assertEqual(config.model_name, "local-model")
        self.assertEqual(config.model_timeout_s, 120.0)

        config = sidecar.load_config(
            {
                "MODEL_PORT_URL": "http://127.0.0.1:8080/v1/",
                "MODEL_NAME": "fake",
                "MODEL_REQUEST_TIMEOUT_S": "999",
            }
        )
        self.assertEqual(config.model_port_url, "http://127.0.0.1:8080/v1")
        self.assertEqual(config.model_timeout_s, 120.0)  # protocolplafond

        config = sidecar.load_config({"MODEL_REQUEST_TIMEOUT_S": "0.2"})
        self.assertEqual(config.model_timeout_s, 1.0)  # ondergrens

        config = sidecar.load_config({"MODEL_REQUEST_TIMEOUT_S": "geen-getal"})
        self.assertEqual(config.model_timeout_s, 120.0)

    def test_load_config_rejects_bad_urls(self) -> None:
        for raw in ("", "ftp://x", "http://", "geen-url"):
            config = sidecar.load_config({"MODEL_PORT_URL": raw})
            self.assertIsNone(config.model_port_url, raw)


if __name__ == "__main__":
    unittest.main()
