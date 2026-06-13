"""
Omega AI-Holding — Resource Warden (System Caretaker).
Elke 60 seconden: CPU-temperatuur en load via 1Panel API.
Bij >80°C of >90% load: Telegram-melding + pause niet-kritieke BU-containers (Marketing, App Studio).
Bij dalende waarden: unpause.
"""
import logging
import os
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.FileHandler(LOG_DIR / "resource_warden.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

INTERVAL = 60
TEMP_THRESHOLD = 85.0   # °C — echte oververhitting
LOAD_THRESHOLD = 95.0   # % CPU (psutil)
RECOVER_TEMP_THRESHOLD = 78.0
RECOVER_LOAD_THRESHOLD = 80.0
ALERT_COOLDOWN_SEC = 1800  # max 1 melding per 30 min
SUSTAINED_RECOVERY_CHECKS = 3  # voorkom fladderen rond drempel
# Niet-kritieke BU's die we pauzeren bij overbelasting (Finance blijft draaien)
BU_CONTAINERS_TO_PAUSE = ("bu_marketing", "bu_app_studio")
STATE_FILE = LOG_DIR / "resource_warden_state.json"


def _load_env():
    for env_file in (ROOT / ".env.1panel", ROOT / ".env"):
        if not env_file.exists():
            continue
        with open(env_file, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    k, v = k.strip(), v.strip()
                    if k in ("ONEPANEL_BASE_URL", "ONEPANEL_API_KEY", "TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID") and v:
                        os.environ.setdefault(k, v)


def _send_telegram(text: str) -> bool:
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


def _load_state() -> dict:
    try:
        if STATE_FILE.exists():
            import json
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning("State laden: %s", e)
    return {}


def _save_state(state: dict) -> None:
    try:
        import json
        STATE_FILE.write_text(json.dumps(state), encoding="utf-8")
    except Exception as e:
        logger.warning("State opslaan: %s", e)


def _get_metrics():
    try:
        if ROOT not in __import__("sys").path:
            __import__("sys").path.insert(0, str(ROOT))
        from omega_1panel_bridge import get_host_metrics
        return get_host_metrics()
    except Exception as e:
        logger.warning("get_host_metrics: %s", e)
        return {"ok": False, "load_pct": 0.0, "temp_c": None}


def _pause_bu_containers():
    try:
        if ROOT not in __import__("sys").path:
            __import__("sys").path.insert(0, str(ROOT))
        from omega_1panel_bridge import container_list, container_pause
        cl = container_list()
        if not cl.get("ok") or not cl.get("data"):
            return
        data = cl["data"]
        items = data if isinstance(data, list) else data.get("items", data.get("list", [])) or []
        names = set()
        for c in items:
            if not isinstance(c, dict):
                continue
            name = c.get("name") or c.get("Names")
            if isinstance(name, list):
                name = name[0] if name else ""
            if not name:
                continue
            names.add(name if isinstance(name, str) else str(name))
        for want in BU_CONTAINERS_TO_PAUSE:
            if any(want in n for n in names):
                out = container_pause(want)
                if out.get("ok"):
                    logger.info("Pause: %s", want)
                else:
                    logger.warning("Pause %s: %s", want, out.get("error"))
    except Exception as e:
        logger.warning("Pause BU containers: %s", e)


def _unpause_bu_containers():
    try:
        if ROOT not in __import__("sys").path:
            __import__("sys").path.insert(0, str(ROOT))
        from omega_1panel_bridge import container_list, container_unpause
        cl = container_list()
        if not cl.get("ok") or not cl.get("data"):
            return
        data = cl["data"]
        items = data if isinstance(data, list) else data.get("list", data.get("items", [])) or []
        names = set()
        for c in items:
            if not isinstance(c, dict):
                continue
            name = c.get("name") or c.get("Names")
            if isinstance(name, list):
                name = name[0] if name else ""
            if name:
                names.add(name if isinstance(name, str) else str(name))
        for want in BU_CONTAINERS_TO_PAUSE:
            if any(want in n for n in names):
                out = container_unpause(want)
                if out.get("ok"):
                    logger.info("Unpause: %s", want)
                else:
                    logger.warning("Unpause %s: %s", want, out.get("error"))
    except Exception as e:
        logger.warning("Unpause BU containers: %s", e)


if __name__ == "__main__":
    _load_env()
    logger.info(
        "Resource Warden gestart (interval %ds, alert temp>%s°C of load>%s%%, cooldown %ds)",
        INTERVAL, TEMP_THRESHOLD, LOAD_THRESHOLD, ALERT_COOLDOWN_SEC,
    )
    state = _load_state()
    already_paused = bool(state.get("already_paused"))
    recovery_streak = int(state.get("recovery_streak") or 0)
    last_alert_at = float(state.get("last_alert_at") or 0.0)

    while True:
        try:
            time.sleep(INTERVAL)
            m = _get_metrics()
            load_pct = float(m.get("load_pct") or 0.0)
            temp_c = m.get("temp_c")
            hot = temp_c is not None and float(temp_c) > TEMP_THRESHOLD
            overloaded = load_pct > LOAD_THRESHOLD
            over_threshold = hot or overloaded
            recovered = (
                (temp_c is None or float(temp_c) <= RECOVER_TEMP_THRESHOLD)
                and load_pct <= RECOVER_LOAD_THRESHOLD
            )

            now = time.time()
            if over_threshold:
                recovery_streak = 0
                cooldown_ok = (now - last_alert_at) >= ALERT_COOLDOWN_SEC
                if cooldown_ok:
                    msg = (
                        "Meneer, de NUC wordt te heet of te zwaar belast. "
                        "Ik pauzeer de niet-kritieke Business Units."
                    )
                    if temp_c is not None:
                        msg += f" Temperatuur: {temp_c:.1f}°C."
                    msg += f" Load: {load_pct:.1f}%."
                    if _send_telegram("🌡️ " + msg):
                        logger.info("Telegram melding verzonden (overbelasting)")
                        last_alert_at = now
                if not already_paused:
                    _pause_bu_containers()
                    already_paused = True
            elif recovered:
                recovery_streak += 1
                if already_paused and recovery_streak >= SUSTAINED_RECOVERY_CHECKS:
                    _unpause_bu_containers()
                    already_paused = False
                    recovery_streak = 0
                    if (now - last_alert_at) < 86400:
                        _send_telegram("✅ NUC weer binnen norm. Niet-kritieke BU's hervat.")
            else:
                recovery_streak = 0

            _save_state({
                "already_paused": already_paused,
                "recovery_streak": recovery_streak,
                "last_alert_at": last_alert_at,
            })
        except KeyboardInterrupt:
            logger.info("Resource Warden gestopt")
            break
        except Exception as e:
            logger.exception("Warden loop: %s", e)
