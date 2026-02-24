"""
Omega AI-Holding — 1Panel API-helper.
Token: md5('1panel' + API_KEY + Timestamp). Headers: 1Panel-Token, 1Panel-Timestamp.
Gebruik: from scripts.onepanel_api import onepanel_request, get_system_status
Of CLI: python3 scripts/onepanel_api.py status
"""
import hashlib
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _load_env_1panel() -> None:
    """Laad .env.1panel als ONEPANEL_* nog niet gezet zijn."""
    if os.environ.get("ONEPANEL_BASE_URL"):
        return
    env_file = ROOT / ".env.1panel"
    if not env_file.exists():
        return
    with open(env_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                k, v = k.strip(), v.strip()
                if k in ("ONEPANEL_BASE_URL", "ONEPANEL_API_KEY") and v:
                    os.environ.setdefault(k, v)


def _token() -> tuple[str, str]:
    """Return (token, timestamp) voor 1Panel headers."""
    _load_env_1panel()
    api_key = os.environ.get("ONEPANEL_API_KEY", "")
    ts = str(int(__import__("time").time()))
    raw = f"1panel{api_key}{ts}"
    token = hashlib.md5(raw.encode()).hexdigest()
    return token, ts


def onepanel_request(method: str, path: str, data: dict | None = None) -> dict | list:
    """
    Doe een 1Panel API-aanroep. path is relatief, bijv. 'dashboard/base/os'.
    Returns JSON body of raises.
    """
    import urllib.request

    _load_env_1panel()
    base = (os.environ.get("ONEPANEL_BASE_URL") or "").rstrip("/")
    if not base:
        raise RuntimeError("ONEPANEL_BASE_URL niet gezet. Run: ./scripts/install_1panel_bridge.sh")
    token, ts = _token()
    url = f"{base}/api/v1/{path.lstrip('/')}"
    req = urllib.request.Request(url, method=method.upper() if method else "GET")
    req.add_header("1Panel-Token", token)
    req.add_header("1Panel-Timestamp", ts)
    req.add_header("Content-Type", "application/json")
    if data:
        req.data = json.dumps(data).encode("utf-8")
    with urllib.request.urlopen(req, timeout=15) as resp:
        out = resp.read().decode("utf-8")
        return json.loads(out) if out else {}


def get_system_status() -> dict:
    """Haal basis systeeminfo op (OS, CPU, RAM) van 1Panel dashboard."""
    try:
        return onepanel_request("GET", "dashboard/base/os")
    except Exception as e:
        return {"error": str(e), "available": False}


def get_containers() -> list | dict:
    """Lijst containers (Docker) via 1Panel. Endpoint kan per 1Panel-versie verschillen."""
    try:
        # Veel 1Panel Swagger: container list onder een container/docker path
        return onepanel_request("GET", "containers")
    except Exception as e:
        return {"error": str(e)}


def main() -> int:
    """CLI: python3 onepanel_api.py status"""
    if len(sys.argv) < 2 or sys.argv[1] != "status":
        print("Usage: python3 onepanel_api.py status")
        return 1
    _load_env_1panel()
    if not os.environ.get("ONEPANEL_BASE_URL"):
        print("ONEPANEL_BASE_URL niet gezet. Run: ./scripts/install_1panel_bridge.sh")
        return 1
    try:
        data = get_system_status()
        print(json.dumps(data, indent=2, ensure_ascii=False))
        return 0
    except Exception as e:
        print(f"Error: {e}")
        return 1


if __name__ == "__main__":
    sys.exit(main() or 0)
