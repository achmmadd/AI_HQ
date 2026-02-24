"""
Omega Holding — 1Panel Edition: centrale bridge naar de 1Panel API (poort 8089 of ONEPANEL_BASE_URL).
- CPU/RAM van containers
- Herstarten van Business Units (containers)
- Firewall (Vesting-modus) — indien door 1Panel API ondersteund
Laad .env.1panel of zet ONEPANEL_BASE_URL en ONEPANEL_API_KEY.
"""
from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent

# Standaard 1Panel poort (override via ONEPANEL_BASE_URL)
DEFAULT_1PANEL_PORT = 8089


def _load_env() -> None:
    if os.environ.get("ONEPANEL_BASE_URL"):
        return
    for env_file in (ROOT / ".env.1panel", ROOT / ".env"):
        if not env_file.exists():
            continue
        with open(env_file, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    k, v = k.strip(), v.strip()
                    if k in ("ONEPANEL_BASE_URL", "ONEPANEL_API_KEY") and v and not v.startswith("#"):
                        os.environ.setdefault(k, v)


def _token() -> tuple[str, str]:
    _load_env()
    api_key = os.environ.get("ONEPANEL_API_KEY", "")
    ts = str(int(time.time()))
    raw = f"1panel{api_key}{ts}"
    token = hashlib.md5(raw.encode()).hexdigest()
    return token, ts


def request(method: str, path: str, data: dict | None = None) -> Any:
    """1Panel API-aanroep. path relatief, bijv. 'containers/search'."""
    import urllib.error
    import urllib.request

    _load_env()
    base = (os.environ.get("ONEPANEL_BASE_URL") or "").rstrip("/")
    if not base:
        raise RuntimeError("ONEPANEL_BASE_URL niet gezet. Run: ./scripts/install_1panel_bridge.sh")
    token, ts = _token()
    url = f"{base}/api/v1/{path.lstrip('/')}"
    req = urllib.request.Request(url, method=method.upper())
    req.add_header("1Panel-Token", token)
    req.add_header("1Panel-Timestamp", ts)
    req.add_header("Content-Type", "application/json")
    if data is not None:
        req.data = json.dumps(data).encode("utf-8")
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            out = resp.read().decode("utf-8")
            code = getattr(resp, "status", None)
            if not out.strip():
                return {}
            try:
                return json.loads(out)
            except json.JSONDecodeError as e:
                raise RuntimeError(
                    f"Server gaf geen JSON (HTTP {code or '?'}). Vaak: verkeerde poort (8501 = Omega-dashboard, niet 1Panel; 1Panel vaak 8089) of 403. Eerste bytes: {out[:120]!r}"
                ) from e
    except urllib.error.HTTPError as e:
        raise RuntimeError(
            f"HTTP {e.code}: {e.reason}. URL: {url}. Controleer poort (1Panel niet 8501) en API/allowlist in 1Panel."
        ) from e


# ——— Dashboard / host ———

def get_host_stats() -> dict[str, Any]:
    """Uptime, load, disk (1Panel dashboard/base)."""
    try:
        os_info = request("GET", "dashboard/base/os")
        return {"ok": True, "data": os_info}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def get_host_metrics() -> dict[str, Any]:
    """CPU load (0–100%) en temperatuur (°C) voor Resource Warden. Gebruikt 1Panel API + fallback /proc, /sys."""
    out: dict[str, Any] = {"ok": True, "load_pct": 0.0, "temp_c": None, "raw": None}
    # 1) Load en temp uit 1Panel
    try:
        stats = get_host_stats()
        if stats.get("ok") and stats.get("data"):
            d = stats["data"]
            inner = d.get("data", d) if isinstance(d, dict) else d
            if isinstance(inner, dict):
                out["raw"] = inner
                # Load: load1, load5, load15 of loadAverage (soms genormaliseerd)
                load1 = inner.get("load1") or inner.get("loadOne") or inner.get("load")
                load5 = inner.get("load5") or inner.get("loadFive")
                load15 = inner.get("load15") or inner.get("loadFifteen")
                if load1 is not None:
                    try:
                        load_val = float(load1)
                        # Schatting: load ~ gebruik over N cores; als > 1 dan > 100% mogelijk
                        cores = max(1, int(inner.get("cpuCores") or inner.get("cores") or 1))
                        out["load_pct"] = min(100.0, (load_val / cores) * 100.0)
                    except (TypeError, ValueError):
                        pass
                # Temperatuur (als 1Panel het levert)
                t = inner.get("temperature") or inner.get("temp") or inner.get("cpuTemp")
                if t is not None:
                    try:
                        out["temp_c"] = float(t)
                    except (TypeError, ValueError):
                        pass
    except Exception:
        pass
    # 2) Fallback: /proc/loadavg en /sys/class/thermal (op host)
    if out["temp_c"] is None:
        for path in ("/sys/class/thermal/thermal_zone0/temp", "/sys/class/hwmon/hwmon0/temp1_input"):
            try:
                with open(path, encoding="utf-8") as f:
                    out["temp_c"] = int(f.read().strip()) / 1000.0
                break
            except (OSError, ValueError):
                continue
    if out["load_pct"] == 0.0:
        try:
            with open("/proc/loadavg", encoding="utf-8") as f:
                parts = f.read().strip().split()
            if parts:
                load1 = float(parts[0])
                # Geen core-count hier; 1.0 = 100% bij 1 core
                out["load_pct"] = min(100.0, load1 * 100.0)
        except (OSError, ValueError):
            pass
    return out


# ——— Containers: lijst, CPU/RAM, herstart ———

def container_list() -> dict[str, Any]:
    """Lijst alle containers (1Panel: containers/search of containers/list)."""
    for path in ("containers/search", "containers/list", "containers"):
        try:
            out = request("GET", path)
            if isinstance(out, (list, dict)):
                return {"ok": True, "data": out}
        except Exception as e:
            if "404" not in str(e):
                return {"ok": False, "error": str(e)}
    return {"ok": False, "error": "Geen container-endpoint gevonden. Check 1Panel Swagger."}


def container_stats(container_name: str) -> dict[str, Any]:
    """CPU/RAM voor één container (naam of ID)."""
    try:
        cl = container_list()
        if not cl.get("ok") or not cl.get("data"):
            return cl
        data = cl["data"]
        items = data if isinstance(data, list) else data.get("items", data.get("list", [])) or []
        for c in items:
            name = (c.get("name") or c.get("Names") or "") if isinstance(c, dict) else ""
            if not name:
                continue
            if container_name in name or (isinstance(name, list) and any(container_name in n for n in name)):
                return {"ok": True, "data": c}
        return {"ok": False, "error": f"Container '{container_name}' niet gevonden"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def container_restart(container_name: str) -> dict[str, Any]:
    """Geef 1Panel opdracht container te herstarten (Vesting: alleen toegestane actie)."""
    for path in ("containers/operate", "containers/restart", "container/operate"):
        try:
            body = {"names": [container_name], "operation": "restart"}
            if "operate" in path:
                body = {"names": [container_name], "action": "restart"}
            out = request("POST", path, body)
            return {"ok": True, "message": f"Herstart aangevraagd: {container_name}", "data": out}
        except Exception as e:
            err = str(e)
            if "404" in err or "405" in err:
                continue
            return {"ok": False, "error": err}
    return {"ok": False, "error": "Geen restart-endpoint gevonden. Zie 1Panel Swagger: containers/operate"}


def _container_operate(container_name: str, operation: str) -> dict[str, Any]:
    """Algemene container-actie: restart, pause, unpause."""
    for path in ("containers/operate", "container/operate"):
        try:
            body = {"names": [container_name], "operation": operation}
            out = request("POST", path, body)
            return {"ok": True, "message": f"{operation}: {container_name}", "data": out}
        except Exception as e:
            err = str(e)
            if "404" in err or "405" in err:
                continue
            return {"ok": False, "error": err}
    return {"ok": False, "error": f"Endpoint voor {operation} niet gevonden. Zie 1Panel Swagger."}


def container_pause(container_name: str) -> dict[str, Any]:
    """Pauzeer container (docker pause) via 1Panel API."""
    return _container_operate(container_name, "pause")


def container_unpause(container_name: str) -> dict[str, Any]:
    """Hervat container (docker unpause) via 1Panel API."""
    return _container_operate(container_name, "unpause")


def container_logs(container_name: str, tail: int = 100) -> dict[str, Any]:
    """Haal recente logs van een container op (1Panel API). Endpoint kan per versie verschillen."""
    for path in (f"containers/logs?name={container_name}&tail={tail}", "containers/logs", "container/logs"):
        try:
            out = request("GET", path)
            if isinstance(out, dict) and "data" in out:
                return {"ok": True, "data": out.get("data"), "raw": out}
            if isinstance(out, (list, str)):
                return {"ok": True, "data": out}
            return {"ok": True, "data": out}
        except Exception as e:
            if "404" not in str(e):
                return {"ok": False, "error": str(e)}
    return {"ok": False, "error": "Log-endpoint niet gevonden. Zie 1Panel Swagger."}


# ——— Firewall (Vesting-modus) ———

def firewall_status() -> dict[str, Any]:
    """Status firewall/WAF (indien 1Panel API ondersteunt)."""
    for path in ("firewall/status", "waf/status", "security/firewall"):
        try:
            out = request("GET", path)
            return {"ok": True, "data": out}
        except Exception:
            continue
    return {"ok": False, "error": "Firewall-endpoint niet beschikbaar in deze 1Panel-versie"}


def firewall_secure() -> dict[str, Any]:
    """Activeer strikte modus (WAF / sluit poorten). Endpoint afhankelijk van 1Panel."""
    for path in ("firewall/secure", "waf/enable", "security/vesting"):
        try:
            out = request("POST", path, {})
            return {"ok": True, "message": "Beveiliging aangescherpt", "data": out}
        except Exception as e:
            if "404" not in str(e):
                return {"ok": False, "error": str(e)}
    return {"ok": False, "error": "Vesting/WAF via API niet beschikbaar. Stel handmatig in 1Panel in."}


if __name__ == "__main__":
    import sys
    _load_env()
    if not os.environ.get("ONEPANEL_BASE_URL"):
        print("Zet ONEPANEL_BASE_URL (en ONEPANEL_API_KEY). Zie .env.1panel")
        sys.exit(1)
    cmd = sys.argv[1] if len(sys.argv) > 1 else "host"
    if cmd == "host":
        print(json.dumps(get_host_stats(), indent=2, ensure_ascii=False))
    elif cmd == "metrics":
        print(json.dumps(get_host_metrics(), indent=2, ensure_ascii=False))
    elif cmd == "containers":
        print(json.dumps(container_list(), indent=2, ensure_ascii=False))
    elif cmd == "restart" and len(sys.argv) > 2:
        print(json.dumps(container_restart(sys.argv[2]), indent=2, ensure_ascii=False))
    elif cmd == "pause" and len(sys.argv) > 2:
        print(json.dumps(container_pause(sys.argv[2]), indent=2, ensure_ascii=False))
    elif cmd == "unpause" and len(sys.argv) > 2:
        print(json.dumps(container_unpause(sys.argv[2]), indent=2, ensure_ascii=False))
    elif cmd == "logs" and len(sys.argv) > 2:
        tail = int(sys.argv[3]) if len(sys.argv) > 3 else 100
        print(json.dumps(container_logs(sys.argv[2], tail=tail), indent=2, ensure_ascii=False))
    elif cmd == "secure":
        print(json.dumps(firewall_secure(), indent=2, ensure_ascii=False))
    else:
        print("Usage: python3 omega_1panel_bridge.py host|metrics|containers|restart|pause|unpause <name>|logs <name>|secure")
