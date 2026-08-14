"""Hermes sidecar — fase-0 sidecarprotocol-skeleton (integratiesprint spoor B).

Spreekt het gedeelde sidecarprotocol uit
ai-motor/pilot/evidence/integration-sprint/PHASE-0.md over HTTP/JSON,
uitsluitend loopback/intern:

    GET  /health  -> {"status": "ok" | "degraded" | "down"}   (<= 5 s)
    POST /invoke  <- {"task_id", "run_id", "attempt_id", "input"}
                  -> {"output"} + exacte echo van de drie causale id's
    POST /cancel  <- {"attempt_id"} -> {"cancelled"}          (<= 5 s)

Bewust ALLEEN de Python-standaardbibliotheek (json / os / threading /
http.server): importeerbaar en draaibaar zonder enige dependency, en er is
met opzet GEEN Hermes-import. De echte runtime-aanroepen zijn gemarkeerd
met TODO(hermes-wire); zolang die niet bedraad zijn, antwoordt /invoke
eerlijk met 501 in plaats van een gefabuleerd modelresultaat.

Geen secrets, geen echte hosts: bind-adres en poort komen uit de
omgeving (HERMES_SIDECAR_HOST / HERMES_SIDECAR_PORT), met loopback-
defaults. Importeren start nooit een server — alleen main() doet dat.
"""

from __future__ import annotations

import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Fase-0 protocolgrens: request/response <= 1 MiB.
PROTOCOL_MAX_BODY_BYTES = 1024 * 1024

# Loopback-defaults; de compose-overlay zet HERMES_SIDECAR_HOST/PORT expliciet.
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 4410

# In-flight registry zodat /cancel een lopende attempt kan onderbreken.
# Puur in-memory: de sidecar is stateless en bezit geen duurzame staat.
_IN_FLIGHT: dict[str, threading.Event] = {}
_IN_FLIGHT_LOCK = threading.Lock()


def register_attempt(attempt_id: str) -> threading.Event:
    """Registreer een lopende attempt; geeft haar cancellation-token terug."""
    token = threading.Event()
    with _IN_FLIGHT_LOCK:
        _IN_FLIGHT[attempt_id] = token
    return token


def finish_attempt(attempt_id: str) -> None:
    """Verwijder de attempt uit het registry (altijd in een finally aanroepen)."""
    with _IN_FLIGHT_LOCK:
        _IN_FLIGHT.pop(attempt_id, None)


def cancel_attempt(attempt_id: str) -> bool:
    """Markeer de attempt als geannuleerd; True als hij in-flight was."""
    with _IN_FLIGHT_LOCK:
        token = _IN_FLIGHT.get(attempt_id)
    if token is None:
        return False
    token.set()
    return True


def health_status() -> str:
    """Gezondheid van de sidecar + runtime.

    TODO(hermes-wire): ping hier de echte Hermes-runtime en rapporteer
    "degraded" of "down" bij storing, in plaats van het statische "ok"
    van dit skeleton.
    """
    return "ok"


def invoke_hermes(task_id: str, run_id: str, attempt_id: str, prompt: str) -> str:
    """Voer één attempt uit op de Hermes-runtime en geef de tekstoutput.

    TODO(hermes-wire): de echte aanroep komt hier. Verwachte vorm (in deze
    lane bewust NIET geïmplementeerd — geen Hermes-dependency, geen pip
    install, geen netwerk naar buiten):

      1. bouw een Hermes-sessie/-bericht van `prompt`;
      2. registreer de attempt met register_attempt(attempt_id) en poll het
         token in de runtime-loop zodat /cancel de run onderbreekt
         (finish_attempt(attempt_id) in een finally);
      3. geef de finale tekstoutput terug.

    De causale id's worden door de handler verbatim ge-echoid; deze functie
    mag nooit zelf id's verzinnen — de Node-adapter verifieert de echo en
    wijst afwijkingen als causal_mismatch af.
    """
    raise NotImplementedError(
        "hermes runtime not wired — lane B levert alleen het protocolskeleton"
    )


class SidecarHandler(BaseHTTPRequestHandler):
    """Minimale HTTP/JSON-handler voor het fase-0 sidecarprotocol."""

    protocol_version = "HTTP/1.1"
    server_version = "hermes-sidecar/0.1.0"

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_json_body(self) -> tuple[dict | None, str | None]:
        raw_length = self.headers.get("Content-Length")
        if raw_length is None:
            return None, "missing_content_length"
        try:
            length = int(raw_length)
        except ValueError:
            return None, "invalid_content_length"
        if length < 0 or length > PROTOCOL_MAX_BODY_BYTES:
            return None, "body_exceeds_protocol_bound"
        try:
            parsed = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None, "invalid_json"
        if not isinstance(parsed, dict):
            return None, "json_object_required"
        return parsed, None

    def do_GET(self) -> None:  # noqa: N802 (http.server-API)
        if self.path == "/health":
            self._send_json(200, {"status": health_status()})
        else:
            self._send_json(404, {"error": "not_found"})

    def do_POST(self) -> None:  # noqa: N802 (http.server-API)
        if self.path == "/invoke":
            self._handle_invoke()
        elif self.path == "/cancel":
            self._handle_cancel()
        else:
            self._send_json(404, {"error": "not_found"})

    def _handle_invoke(self) -> None:
        body, error = self._read_json_body()
        if body is None:
            status = 413 if error == "body_exceeds_protocol_bound" else 400
            self._send_json(status, {"error": error})
            return
        task_id = body.get("task_id")
        run_id = body.get("run_id")
        attempt_id = body.get("attempt_id")
        prompt = body.get("input")
        if (
            not all(isinstance(v, str) and v for v in (task_id, run_id, attempt_id))
            or not isinstance(prompt, str)
        ):
            self._send_json(
                400, {"error": "task_id_run_id_attempt_id_and_input_required"}
            )
            return
        try:
            output = invoke_hermes(task_id, run_id, attempt_id, prompt)
        except NotImplementedError:
            # Skeleton: eerlijk 501 in plaats van een gefabuleerd resultaat.
            self._send_json(
                501,
                {
                    "error": "hermes_runtime_not_wired",
                    "task_id": task_id,
                    "run_id": run_id,
                    "attempt_id": attempt_id,
                },
            )
            return
        # Exacte echo van de causale id's — de Node-adapter verifieert ze.
        self._send_json(
            200,
            {
                "output": output,
                "task_id": task_id,
                "run_id": run_id,
                "attempt_id": attempt_id,
            },
        )

    def _handle_cancel(self) -> None:
        body, error = self._read_json_body()
        if body is None:
            self._send_json(400, {"error": error})
            return
        attempt_id = body.get("attempt_id")
        if not isinstance(attempt_id, str) or not attempt_id:
            self._send_json(400, {"error": "attempt_id_required"})
            return
        self._send_json(200, {"cancelled": cancel_attempt(attempt_id)})


def main() -> None:
    host = os.environ.get("HERMES_SIDECAR_HOST", DEFAULT_HOST)
    port = int(os.environ.get("HERMES_SIDECAR_PORT", str(DEFAULT_PORT)))
    server = ThreadingHTTPServer((host, port), SidecarHandler)
    print(
        f"hermes-sidecar luistert op http://{host}:{port} "
        "(alleen loopback/intern; skeleton zonder Hermes-runtime)",
        flush=True,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
