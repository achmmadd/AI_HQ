"""
Omega Supremacy — Tunnel Watcher.
- Pollt cloudflared-logs op een trycloudflare.com URL.
- Bij nieuwe URL: schrijf naar mission_control.state.tunnel_url en stuur Telegram-alert.
"""
import os
import re
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TRYCLOUDFLARE_RE = re.compile(r"https://[a-zA-Z0-9.-]+\.trycloudflare\.com")
CLOUDFLARED_CONTAINER = "omega-cloudflared"


def _load_env():
    env = ROOT / ".env"
    if not env.exists():
        return
    with open(env, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                k, v = k.strip(), v.strip()
                if len(v) >= 2 and v[0] in "'\"" and v[0] == v[-1]:
                    v = v[1:-1]
                os.environ.setdefault(k, v)


def _send_telegram(text: str) -> None:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        return
    try:
        import urllib.request
        import urllib.parse

        url = f"https://api.telegram.org/bot{token}/sendMessage"
        data = urllib.parse.urlencode({"chat_id": chat_id, "text": text[:4000]}).encode()
        req = urllib.request.Request(url, data=data, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        urllib.request.urlopen(req, timeout=10)
    except Exception:
        pass


def _get_current_tunnel_url() -> str:
    try:
        from mission_control import get_tunnel_url

        return get_tunnel_url() or ""
    except Exception:
        return ""


def _set_current_tunnel_url(url: str) -> None:
    try:
        from mission_control import set_tunnel_url

        set_tunnel_url(url)
    except Exception:
        pass


def _scan_logs() -> str | None:
    """Lees cloudflared-logs en haal de laatste trycloudflare-URL op."""
    for cmd in ("docker", "podman"):
        try:
            r = subprocess.run(
                [cmd, "logs", CLOUDFLARED_CONTAINER, "--tail", "300"],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=str(ROOT),
            )
            out = (r.stdout or "") + (r.stderr or "")
            m = TRYCLOUDFLARE_RE.search(out)
            if m:
                return m.group(0)
        except FileNotFoundError:
            continue
        except subprocess.TimeoutExpired:
            continue
        except Exception:
            continue
    return None


def run() -> None:
    _load_env()
    prev = _get_current_tunnel_url()
    while True:
        try:
            url = _scan_logs()
            if url and url != prev:
                _set_current_tunnel_url(url)
                _send_telegram(f"🚀 Dashboard Herstart. Nieuwe link: {url}")
                prev = url
        except Exception:
            pass
        time.sleep(60)


if __name__ == "__main__":
    run()
