"""
Omega Holding — 1Panel Log-Watcher.
Scant Docker/1Panel-logs op Error of Panic en stuurt een actieplan naar Telegram.
Run: python3 scripts/onepanel_log_watcher.py
Of als daemon/cron: elke minuut of bij wijze van tail.
"""
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


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
                if k in ("TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID") and v:
                    os.environ.setdefault(k, v)


def _send_telegram(text: str) -> bool:
    token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        return False
    try:
        import urllib.request
        import urllib.parse
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        data = urllib.parse.urlencode({"chat_id": chat_id, "text": text[:4000], "disable_web_page_preview": "1"}).encode()
        req = urllib.request.Request(url, data=data, method="POST")
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception:
        return False


def _tail_log(path: Path, lines: int = 200) -> str:
    if not path.exists():
        return ""
    try:
        out = subprocess.run(
            ["tail", "-n", str(lines), str(path)],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=str(ROOT),
        )
        return out.stdout or ""
    except Exception:
        return ""


def _docker_logs(container: str, lines: int = 100) -> str:
    try:
        out = subprocess.run(
            ["docker", "logs", "--tail", str(lines), container],
            capture_output=True,
            text=True,
            timeout=10,
            cwd=str(ROOT),
        )
        return (out.stdout or "") + (out.stderr or "")
    except Exception:
        return ""


def scan_for_errors() -> list[tuple[str, str]]:
    """Return [(bron, regel)] van regels met Error of Panic."""
    found = []
    # Lokale logbestanden
    for name in ("telegram_bridge.log", "engineer.log", "streamlit.log"):
        path = ROOT / "logs" / name
        text = _tail_log(path)
        for line in text.splitlines():
            if re.search(r"\b(Error|PANIC|panic|Fatal|CRITICAL)\b", line, re.I):
                found.append((name, line.strip()[:500]))
    # Docker containers (omega_*)
    for c in ("omega_core", "omega_dashboard", "bu_marketing", "bu_app_studio", "bu_finance"):
        text = _docker_logs(c)
        for line in text.splitlines():
            if re.search(r"\b(Error|PANIC|panic|Fatal|CRITICAL)\b", line, re.I):
                found.append((c, line.strip()[:500]))
    return found


def main() -> int:
    _load_env()
    errors = scan_for_errors()
    if not errors:
        return 0
    # Actieplan voor Telegram
    lines = ["⚠️ Jarvis — Log-waarschuwing\n"]
    seen = set()
    for source, line in errors[:15]:
        key = (source, line[:200])
        if key in seen:
            continue
        seen.add(key)
        lines.append(f"[{source}] {line}")
    lines.append("\nActie: Controleer 1Panel → Containers / Logs. Overweeg /restart <container> of herstart via 1Panel.")
    text = "\n".join(lines)
    if _send_telegram(text):
        print("Telegram-alert verzonden.")
    else:
        print("TELEGRAM_CHAT_ID niet gezet; alert niet verzonden.", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
