"""
Omega AI-Holding — Engineer daemon (Auto-Repair + Lockdown).
- Check: Omega-bridge. Bij uitval: 1Panel API container restart + melding naar Telegram.
- Lockdown: als data/lockdown.flag bestaat → stop cloudflared container, meld via Telegram.
Start via launch_factory.sh.
"""
import logging
import os
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LOG_DIR = ROOT / "logs"
LOCKDOWN_FLAG = ROOT / "data" / "lockdown.flag"
CLOUDFLARED_CONTAINER = "omega-cloudflared"
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.FileHandler(LOG_DIR / "engineer.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

INTERVAL = 300       # seconden (5 min) voor bridge-check
LOCKDOWN_INTERVAL = 30  # seconden voor lockdown-flag check
HEARTBEAT_TIMEOUT = 600  # seconden (10 min) zonder heartbeat → rollback
HEARTBEAT_ROLLBACK_COOLDOWN = 3600  # na rollback min. 1 uur wachten voor volgende


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
    """Stuur bericht naar TELEGRAM_CHAT_ID."""
    _load_env()
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
    except Exception as e:
        logger.warning("Telegram send: %s", e)
        return False


BRIDGE_CONTAINER = "omega-telegram-bridge"


def check_bridge():
    """Of de Omega-bridge nog draait: lokaal via pgrep, in Docker via docker inspect."""
    # 1) Lokaal (launch_factory): proces in deze machine
    try:
        out = subprocess.run(
            ["pgrep", "-f", "telegram_bridge.py"],
            capture_output=True,
            text=True,
            timeout=5,
            cwd=str(ROOT),
        )
        pids = [p for p in (out.stdout or "").strip().splitlines() if p]
        for pid in pids:
            try:
                with open(f"/proc/{pid}/cmdline", encoding="utf-8", errors="ignore") as f:
                    cmd = f.read().replace("\x00", " ")
                if "--zwartehand" not in cmd:
                    return True
            except (OSError, ValueError):
                pass
    except Exception:
        pass

    # 2) Docker: bridge draait in andere container — check of die container running is
    for cmd in (
        ["docker", "inspect", "--format", "{{.State.Running}}", BRIDGE_CONTAINER],
        ["podman", "inspect", "--format", "{{.State.Running}}", BRIDGE_CONTAINER],
    ):
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=10, cwd=str(ROOT))
            if r.returncode == 0 and "true" in (r.stdout or "").strip().lower():
                return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
    return False


def _try_1panel_restart(container_name: str) -> bool:
    """Probeer container te herstarten via 1Panel API."""
    try:
        sys_path = str(ROOT)
        if sys_path not in __import__("sys").path:
            __import__("sys").path.insert(0, sys_path)
        from omega_1panel_bridge import container_restart
        out = container_restart(container_name)
        return out.get("ok", False)
    except Exception as e:
        logger.warning("1Panel restart %s: %s", container_name, e)
        return False


def _cloudflared_running() -> bool:
    """Of de cloudflared container draait (docker of podman)."""
    for cmd in (["docker", "inspect", "--format", "{{.State.Running}}", CLOUDFLARED_CONTAINER],
                ["podman", "inspect", "--format", "{{.State.Running}}", CLOUDFLARED_CONTAINER]):
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=10, cwd=str(ROOT))
            return r.returncode == 0 and "true" in (r.stdout or "").strip().lower()
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
    return False


def _stop_cloudflared() -> bool:
    """Stop de cloudflared container (docker stop of podman stop)."""
    for cmd in (["docker", "stop", CLOUDFLARED_CONTAINER], ["podman", "stop", CLOUDFLARED_CONTAINER]):
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=30, cwd=str(ROOT))
            if r.returncode == 0:
                logger.info("Cloudflared container gestopt: %s", CLOUDFLARED_CONTAINER)
                return True
        except (FileNotFoundError, subprocess.TimeoutExpired):
            continue
    return False


def _heartbeat_last_ts() -> int | None:
    """Laatste heartbeat-timestamp uit omega_db (Unix seconden)."""
    try:
        sys_path = str(ROOT)
        if sys_path not in __import__("sys").path:
            __import__("sys").path.insert(0, sys_path)
        import omega_db
        omega_db.init_schema()
        return omega_db.heartbeat_last_ts()
    except Exception as e:
        logger.debug("heartbeat_last_ts: %s", e)
        return None


def _do_heartbeat_rollback() -> bool:
    """git reset --hard HEAD in ROOT en Telegram melding. Geen force push."""
    try:
        r = subprocess.run(
            ["git", "reset", "--hard", "HEAD"],
            cwd=str(ROOT),
            capture_output=True,
            text=True,
            timeout=15,
        )
        if r.returncode == 0:
            logger.warning("Heartbeat rollback uitgevoerd: git reset --hard HEAD")
            return True
        logger.warning("Heartbeat rollback mislukt: %s", r.stderr or r.stdout)
        return False
    except Exception as e:
        logger.warning("Heartbeat rollback: %s", e)
        return False


if __name__ == "__main__":
    logger.info("Engineer daemon gestart (bridge %ds, lockdown %ds, heartbeat timeout %ds)", INTERVAL, LOCKDOWN_INTERVAL, HEARTBEAT_TIMEOUT)
    last_bridge_check = 0.0
    lockdown_notified = False
    last_heartbeat_rollback_at = 0.0

    while True:
        try:
            now = time.time()

            # ——— Heartbeat-watcher: bij timeout git rollback + Telegram ———
            last_ts = _heartbeat_last_ts()
            if last_ts is not None and (now - last_ts) > HEARTBEAT_TIMEOUT:
                if (now - last_heartbeat_rollback_at) >= HEARTBEAT_ROLLBACK_COOLDOWN:
                    if _do_heartbeat_rollback():
                        last_heartbeat_rollback_at = now
                        msg = "⚠️ Heartbeat uitgevallen; rollback uitgevoerd (git reset --hard HEAD). Controleer de NUC."
                        if _send_telegram(msg):
                            logger.info("Heartbeat rollback Telegram verzonden")
            else:
                if last_ts is not None:
                    last_heartbeat_rollback_at = 0.0  # reset cooldown zodra heartbeat weer binnenkomt

            # ——— Lockdown: continu check op data/lockdown.flag ———
            if LOCKDOWN_FLAG.exists():
                if _cloudflared_running():
                    stopped = _stop_cloudflared()
                    if stopped and not lockdown_notified:
                        msg = "🚨 LOCKDOWN GEACTIVEERD: Alle externe toegang tot de NUC is fysiek verbroken."
                        if _send_telegram(msg):
                            logger.info("Lockdown Telegram verzonden")
                        lockdown_notified = True
                else:
                    lockdown_notified = True  # al uit, melding al gedaan of niet nodig
            else:
                lockdown_notified = False

            # ——— Bridge check: elke INTERVAL seconden ———
            if now - last_bridge_check >= INTERVAL:
                last_bridge_check = now
                if check_bridge():
                    logger.info("Engineer check: Omega-bridge draait")
                else:
                    logger.warning("Engineer check: Omega-bridge niet gevonden — auto-repair")
                    restarted = _try_1panel_restart(BRIDGE_CONTAINER)
                    msg = "Meneer, Omega Telegram-bridge was uitgevallen. 1Panel herstart: " + ("gelukt." if restarted else "niet gelukt (handmatig: ./launch_factory.sh).")
                    if _send_telegram("🔧 " + msg):
                        logger.info("Telegram melding verzonden")
                    else:
                        logger.warning("Zet TELEGRAM_CHAT_ID in .env voor auto-repair meldingen.")

            time.sleep(LOCKDOWN_INTERVAL)
        except KeyboardInterrupt:
            logger.info("Engineer daemon gestopt")
            break
