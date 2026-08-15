"""Hermes sidecar — de Motor-Hermes-runtime achter het fase-0 sidecarprotocol.

Runtime-activatie (sprint P0.6, spoor A): dit is geen skeleton meer. De
sidecar voert de synthetische taak werkelijk uit door de geconfigureerde
OpenAI-compatible modelendpoint (`POST {MODEL_PORT_URL}/chat/completions`)
aan te roepen — met `chat_template_kwargs: {enable_thinking: false}` zodat
Qwen op llama.cpp geen lege content in thinking mode teruggeeft — en
spreekt het gedeelde protocol uit
ai-motor/pilot/evidence/integration-sprint/PHASE-0.md over HTTP/JSON,
uitsluitend loopback/intern:

    GET  /health  -> {"status": "ok" | "degraded" | "down"}   (<= 5 s)
    POST /invoke  <- {"task_id", "run_id", "attempt_id", "input"}
                  -> {"output"} + exacte echo van de drie causale id's
    POST /cancel  <- {"attempt_id"} -> {"cancelled"}          (<= 5 s)

Ieder antwoord (ook fouten en 404's) draagt `"protocol": "motor-sidecar/1"`.

Bewust ALLEEN de Python-standaardbibliotheek: er bestaat geen extern te
pinnen "Hermes"-package — dit proces IS de Motor-Hermes-runtime. Geen tools,
geen memory-SSOT, geen credentials in het proces, geen volumes. De
modelendpoint komt uitsluitend uit de omgeving (`MODEL_PORT_URL`); de repo
bevat nooit een echte waarde en in tests/CI is het altijd een fake endpoint.

Foutmapping naar de fase-0-taxonomie van de Node-adapter (HTTP -> code):

    model onbereikbaar / HTTP 429|5xx van het model  -> 503 -> unavailable (retryable)
    begrensde model-wachttijd overschreden           -> 504 -> unavailable (retryable)
    modelantwoord kapot/oversized/verkeerd schema,
    of model weigert de vraag (andere 4xx)           -> 422 -> malformed_response (terminaal)
    geannuleerde attempt                             -> 200 {"cancelled": true}
    onverwachte interne fout                         -> 500 -> unavailable (retryable)

De taxonomie kent geen "rejected"- of "internal"-code; 4xx van de sidecar
mapt de adapter op de terminale `malformed_response`, 5xx op de retryable
`unavailable`. Een eigen retryloop voert de sidecar nooit.

Gezondheid is echte readiness: `/health` peilt `{MODEL_PORT_URL}/models`
met een begrensde probe. Proces op + model bereikbaar -> "ok"; proces op +
model onbereikbaar/niet geconfigureerd -> "degraded". Zo blijft de container
"up" zichtbaar zonder ooit vals groen te rapporteren.

Cancel is async (fase-0 besluit 1): `/cancel` zet het per-attempt token en
sluit de live modelverbinding, zodat de in-flight `/invoke` gecontroleerd
eindigt in plaats van de volle timeout af te wachten.

Importeren start nooit een server — alleen main() doet dat.
"""

from __future__ import annotations

import http.client
import json
import os
import socket
import threading
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Protocolidentificatie: aanwezig in ELK antwoord van deze sidecar.
PROTOCOL_VERSION = "motor-sidecar/1"

# Fase-0 protocolgrenzen: request/response <= 1 MiB, invoke <= 120 s.
PROTOCOL_MAX_BODY_BYTES = 1024 * 1024
MAX_MODEL_TIMEOUT_S = 120.0

# De health-probe moet ruim binnen de fase-0 handshakegrens (5 s) blijven.
HEALTH_PROBE_TIMEOUT_S = 2.0

# Loopback-defaults; de compose-overlay zet HERMES_SIDECAR_HOST/PORT expliciet.
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 4410

# Placeholder-modelnaam — geen echte waarde in de repo; deployments zetten
# MODEL_NAME altijd expliciet via de omgeving.
DEFAULT_MODEL_NAME = "local-model"

ENV_HOST = "HERMES_SIDECAR_HOST"
ENV_PORT = "HERMES_SIDECAR_PORT"
ENV_MODEL_PORT_URL = "MODEL_PORT_URL"
ENV_MODEL_NAME = "MODEL_NAME"
ENV_MODEL_TIMEOUT_S = "MODEL_REQUEST_TIMEOUT_S"


class ModelError(Exception):
    """Basis voor gecontroleerde modelendpoint-fouten."""


class ModelUnavailable(ModelError):
    """Model onbereikbaar of het model antwoordde 429/5xx (retryable)."""


class ModelTimeout(ModelUnavailable):
    """De begrensde model-wachttijd is overschreden (retryable)."""


class ModelMalformed(ModelError):
    """Modelantwoord is kapot, oversized of van verkeerd schema (terminaal)."""


class AttemptCancelled(Exception):
    """De attempt is via /cancel geannuleerd terwijl het model liep."""


class SidecarConfig:
    """Bevroren runtime-configuratie uit de omgeving. Geen secrets."""

    __slots__ = ("model_port_url", "model_name", "model_timeout_s")

    def __init__(
        self,
        model_port_url: str | None,
        model_name: str,
        model_timeout_s: float,
    ) -> None:
        self.model_port_url = model_port_url
        self.model_name = model_name
        self.model_timeout_s = model_timeout_s

    @property
    def chat_completions_url(self) -> str:
        assert self.model_port_url is not None
        return f"{self.model_port_url}/chat/completions"

    @property
    def models_url(self) -> str:
        assert self.model_port_url is not None
        return f"{self.model_port_url}/models"


def _normalize_model_base(raw: str) -> str | None:
    """Valideer en normaliseer MODEL_PORT_URL; None bij onbruikbare waarde."""
    if not raw:
        return None
    try:
        parts = urllib.parse.urlsplit(raw)
    except ValueError:
        return None
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return None
    return raw.rstrip("/")


def _bounded_timeout_s(raw: str | None) -> float:
    """Parse de model-timeout; protocolplafond 120 s, ondergrens 1 s."""
    if raw is None:
        return MAX_MODEL_TIMEOUT_S
    try:
        value = float(raw)
    except ValueError:
        print(
            f"hermes-sidecar: ongeldige {ENV_MODEL_TIMEOUT_S}={raw!r}; "
            f"val terug op {MAX_MODEL_TIMEOUT_S:.0f} s",
            flush=True,
        )
        return MAX_MODEL_TIMEOUT_S
    return min(max(value, 1.0), MAX_MODEL_TIMEOUT_S)


def load_config(env: dict[str, str] | None = None) -> SidecarConfig:
    """Lees de configuratie. De sidecar start ook zonder geldige
    MODEL_PORT_URL — /health rapporteert dan eerlijk "degraded" en /invoke
    een gecontroleerde 503, in plaats van het proces te laten crashen."""
    source = os.environ if env is None else env
    return SidecarConfig(
        model_port_url=_normalize_model_base(
            source.get(ENV_MODEL_PORT_URL, "").strip()
        ),
        model_name=source.get(ENV_MODEL_NAME, "").strip() or DEFAULT_MODEL_NAME,
        model_timeout_s=_bounded_timeout_s(source.get(ENV_MODEL_TIMEOUT_S)),
    )


class _InFlight:
    """Per-attempt annuleertoestand: token + de live modelverbinding.

    Puur in-memory: de sidecar is stateless en bezit geen duurzame staat.
    """

    __slots__ = ("cancelled", "conn")

    def __init__(self) -> None:
        self.cancelled = threading.Event()
        self.conn: http.client.HTTPConnection | None = None


_IN_FLIGHT: dict[str, _InFlight] = {}
_IN_FLIGHT_LOCK = threading.Lock()


def register_attempt(attempt_id: str) -> _InFlight:
    """Registreer een lopende attempt; geeft haar annuleerstaat terug."""
    attempt = _InFlight()
    with _IN_FLIGHT_LOCK:
        _IN_FLIGHT[attempt_id] = attempt
    return attempt


def finish_attempt(attempt_id: str) -> None:
    """Verwijder de attempt uit het registry (altijd in een finally aanroepen)."""
    with _IN_FLIGHT_LOCK:
        _IN_FLIGHT.pop(attempt_id, None)


def cancel_attempt(attempt_id: str) -> bool:
    """Annuleer een in-flight attempt: zet het token en sluit de live
    modelverbinding zodat de geblokkeerde read onmiddellijk opbreekt.
    True als de attempt in-flight was."""
    with _IN_FLIGHT_LOCK:
        attempt = _IN_FLIGHT.get(attempt_id)
    if attempt is None:
        return False
    attempt.cancelled.set()
    conn = attempt.conn
    if conn is not None:
        # close() alleen wekt een in een andere thread geblokkeerde recv niet
        # betrouwbaar; shutdown() stuurt eerst FIN/RST en breekt de blokkade.
        try:
            sock = conn.sock
            if sock is not None:
                sock.shutdown(socket.SHUT_RDWR)
        except OSError:
            pass
        try:
            conn.close()
        except OSError:
            pass
    return True


def _open_connection(url: str, timeout: float) -> http.client.HTTPConnection:
    parts = urllib.parse.urlsplit(url)
    if parts.scheme == "https":
        return http.client.HTTPSConnection(
            parts.hostname, parts.port or 443, timeout=timeout
        )
    return http.client.HTTPConnection(
        parts.hostname, parts.port or 80, timeout=timeout
    )


def _request_target(url: str) -> str:
    parts = urllib.parse.urlsplit(url)
    target = parts.path or "/"
    if parts.query:
        target += "?" + parts.query
    return target


def probe_model(config: SidecarConfig) -> bool:
    """Echte readiness-probe: is de modelendpoint bereikbaar?

    Elk willekeurig HTTP-antwoord (ook 404) bewijst bereikbaarheid; een
    verbindings- of timeoutfout betekent onbereikbaar. De probe stuurt nooit
    een prompt en raakt nooit data.
    """
    if config.model_port_url is None:
        return False
    conn = _open_connection(config.models_url, HEALTH_PROBE_TIMEOUT_S)
    try:
        conn.request("GET", _request_target(config.models_url))
        response = conn.getresponse()
        response.read(4096)
        return True
    except (OSError, http.client.HTTPException):
        return False
    finally:
        conn.close()


def health_status(config: SidecarConfig) -> str:
    """"ok" als het proces draait én het model bereikbaar is, anders
    "degraded". "down" reserveert de adapter voor een sidecar die helemaal
    niet antwoordt — die toestand kan deze functie zelf niet rapporteren."""
    return "ok" if probe_model(config) else "degraded"


def _extract_output(raw: bytes) -> str:
    """Haal de tekstoutput uit een OpenAI-compatible chat.completion.

    Alles dat niet exact het verwachte schema volgt is een ModelMalformed —
    de sidecar verzint nooit zelf een output.
    """
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, UnicodeDecodeError) as exc:
        raise ModelMalformed("model body is geen valide JSON") from exc
    if not isinstance(parsed, dict):
        raise ModelMalformed("model body is geen JSON-object")
    choices = parsed.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ModelMalformed("model body heeft geen non-empty choices-lijst")
    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    content = message.get("content") if isinstance(message, dict) else None
    if not isinstance(content, str) or not content:
        raise ModelMalformed("model body heeft geen non-empty message.content string")
    return content


def call_model(config: SidecarConfig, attempt: _InFlight, prompt: str) -> str:
    """Voer één attempt uit: één OpenAI-compatible chat.completions-call.

    Begrensd op tijd (socket-timeout <= 120 s) én op omvang (response wordt
    nooit verder gelezen dan 1 MiB + 1 byte). Geen tools, geen streaming,
    geen conversation state — elke call is op zichzelf staand.
    """
    url = config.chat_completions_url
    body = json.dumps(
        {
            "model": config.model_name,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            # Qwen op llama.cpp staat standaard in thinking mode: het hele
            # tokenbudget gaat dan naar reasoning_content en content blijft
            # leeg (live gemeten 2026-08-15, P0.7). Dezelfde body-parameter
            # die de llamacpp-Node-adapter al stuurt; een request-bodyveld,
            # geen nieuwe egress.
            "chat_template_kwargs": {"enable_thinking": False},
        }
    ).encode("utf-8")
    conn = _open_connection(url, config.model_timeout_s)
    attempt.conn = conn
    if attempt.cancelled.is_set():
        # Cancel landde tussen registratie en verbinding: niet alsnog verzenden.
        raise AttemptCancelled()
    try:
        conn.request(
            "POST",
            _request_target(url),
            body=body,
            headers={"content-type": "application/json"},
        )
        response = conn.getresponse()
        declared = response.length
        if declared is not None and declared > PROTOCOL_MAX_BODY_BYTES:
            raise ModelMalformed(
                f"model content-length {declared} boven de 1 MiB-protocolgrens"
            )
        raw = response.read(PROTOCOL_MAX_BODY_BYTES + 1)
        # Een cancel die tijdens de read landde kan op sommige platforms als
        # nette EOF in plaats van een fout terugkomen — altijd controleren.
        if attempt.cancelled.is_set():
            raise AttemptCancelled()
        if len(raw) > PROTOCOL_MAX_BODY_BYTES:
            raise ModelMalformed("model body boven de 1 MiB-protocolgrens")
        if response.status == 429 or response.status >= 500:
            raise ModelUnavailable(f"model HTTP {response.status}")
        if response.status != 200:
            # Bijv. onbekende modelnaam: een configuratie-/vraagprobleem —
            # opnieuw proberen helpt niet, dus terminale klasse.
            raise ModelMalformed(f"model HTTP {response.status}")
        return _extract_output(raw)
    except (ModelError, AttemptCancelled):
        raise
    except (socket.timeout, TimeoutError) as exc:
        if attempt.cancelled.is_set():
            raise AttemptCancelled() from exc
        raise ModelTimeout(
            f"model overschreed de {config.model_timeout_s:.0f} s-grens"
        ) from exc
    except (OSError, http.client.HTTPException) as exc:
        # Ook de weg waarlangs /cancel een in-flight call onderbreekt:
        # conn.close() vanuit de cancel-thread laat de read hier fouten.
        if attempt.cancelled.is_set():
            raise AttemptCancelled() from exc
        raise ModelUnavailable(
            f"model onbereikbaar: {exc.__class__.__name__}"
        ) from exc
    finally:
        attempt.conn = None
        try:
            conn.close()
        except OSError:
            pass


class SidecarServer(ThreadingHTTPServer):
    """Threading-server met de bevroren config op de server-instantie."""

    daemon_threads = True

    def __init__(
        self,
        server_address: tuple[str, int],
        config: SidecarConfig,
    ) -> None:
        self.sidecar_config = config
        super().__init__(server_address, SidecarHandler)


class SidecarHandler(BaseHTTPRequestHandler):
    """HTTP/JSON-handler voor het fase-0 sidecarprotocol."""

    protocol_version = "HTTP/1.1"
    server_version = "hermes-sidecar/0.2.0"

    @property
    def _config(self) -> SidecarConfig:
        return self.server.sidecar_config  # type: ignore[attr-defined]

    def _send_json(self, status: int, payload: dict) -> None:
        body = json.dumps({"protocol": PROTOCOL_VERSION, **payload}).encode("utf-8")
        try:
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            # De aanroeper (bijv. de adapter na een lokale abort) is al weg;
            # de attempt is al gecontroleerd beëindigd.
            pass

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

    @staticmethod
    def _echo(task_id: str, run_id: str, attempt_id: str) -> dict:
        """Exacte echo van de causale id's — de Node-adapter verifieert ze;
        deze functie mag nooit zelf id's verzinnen."""
        return {"task_id": task_id, "run_id": run_id, "attempt_id": attempt_id}

    def do_GET(self) -> None:  # noqa: N802 (http.server-API)
        if self.path == "/health":
            status = health_status(self._config)
            self._send_json(
                200,
                {
                    "status": status,
                    "detail": "ok"
                    if status == "ok"
                    else "model_unreachable_or_unconfigured",
                },
            )
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
        echo = self._echo(task_id, run_id, attempt_id)

        config = self._config
        if config.model_port_url is None:
            self._send_json(
                503, {"error": "model_unavailable", "detail": "unconfigured", **echo}
            )
            return

        attempt = register_attempt(attempt_id)
        try:
            output = call_model(config, attempt, prompt)
        except AttemptCancelled:
            # De adapter abortte haar fetch al lokaal; dit antwoord bereikt
            # Motor vrijwel nooit, maar de attempt eindigt wél gecontroleerd.
            self._send_json(200, {"cancelled": True, **echo})
        except ModelTimeout as exc:
            self._send_json(
                504, {"error": "model_timeout", "detail": str(exc), **echo}
            )
        except ModelUnavailable as exc:
            self._send_json(
                503, {"error": "model_unavailable", "detail": str(exc), **echo}
            )
        except ModelMalformed as exc:
            self._send_json(
                422, {"error": "model_malformed_response", "detail": str(exc), **echo}
            )
        except Exception as exc:  # nooit een ongecontroleerde 500-losse crash
            print(
                f"hermes-sidecar: onverwachte fout in attempt {attempt_id}: "
                f"{exc.__class__.__name__}",
                flush=True,
            )
            self._send_json(500, {"error": "internal_error", **echo})
        else:
            self._send_json(200, {"output": output, **echo})
        finally:
            finish_attempt(attempt_id)

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
    host = os.environ.get(ENV_HOST, DEFAULT_HOST)
    port = int(os.environ.get(ENV_PORT, str(DEFAULT_PORT)))
    config = load_config()
    server = SidecarServer((host, port), config)
    print(
        f"hermes-sidecar {PROTOCOL_VERSION} luistert op http://{host}:{port} "
        f"(alleen loopback/intern; model geconfigureerd: "
        f"{'ja' if config.model_port_url else 'nee'})",
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
