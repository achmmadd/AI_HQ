"""
Omega Supremacy — OpenClaw Shared State & Jarvis Protocol.
Single Source of Truth: data/omega.db (omega_db).
Jarvis orchestrates (delegates); specialists execute.
"""
import logging
import uuid
from datetime import datetime, timezone, date
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
AGENTS_DIR = ROOT / "holding" / "agents"
DEFAULT_SPEND_LIMIT_EUR = 10.0

logger = logging.getLogger(__name__)

STATUS_QUEUED = "QUEUED"
STATUS_PENDING = "PENDING"
STATUS_IN_PROGRESS = "IN_PROGRESS"
STATUS_DOING = "DOING"
STATUS_COMPLETED = "COMPLETED"
SPECIALISTS = ("jarvis", "shuri", "vision", "friday")

# Lazy init schema on first use
_schema_inited = False


def _ensure_db():
    global _schema_inited
    if not _schema_inited:
        import omega_db
        omega_db.init_schema()
        _schema_inited = True


def load_state() -> dict:
    """Load from omega.db; return full state (missions + state dict)."""
    _ensure_db()
    import omega_db
    missions = omega_db.missions_get_all()
    state = omega_db.state_get_all()
    state.setdefault("daily_spend_eur", 0.0)
    state.setdefault("spend_limit_eur", DEFAULT_SPEND_LIMIT_EUR)
    state.setdefault("last_reset_date", date.today().isoformat())
    state.setdefault("circuit_breaker_tripped", False)
    state.setdefault("tunnel_url", "")
    return {"missions": missions, "state": state}


def save_state(data: dict) -> None:
    """Persist state keys to omega.db (missions are updated via mission_* functions)."""
    _ensure_db()
    import omega_db
    for k, v in (data.get("state") or {}).items():
        omega_db.state_set(k, v)


def _reset_daily_if_needed(state: dict) -> None:
    today = date.today().isoformat()
    if state.get("last_reset_date") != today:
        state["daily_spend_eur"] = 0.0
        state["last_reset_date"] = today
        state["circuit_breaker_tripped"] = False
        import omega_db
        omega_db.state_set("daily_spend_eur", state["daily_spend_eur"])
        omega_db.state_set("last_reset_date", state["last_reset_date"])
        omega_db.state_set("circuit_breaker_tripped", state["circuit_breaker_tripped"])


def add_mission(
    title: str,
    source: str = "telegram",
    assigned_specialist: str | None = None,
    payload: dict | None = None,
) -> str:
    """Jarvis: add mission to queue; assign specialist. Returns mission id."""
    _ensure_db()
    import omega_db
    data = load_state()
    _reset_daily_if_needed(data["state"])
    specialist = (assigned_specialist or "shuri").lower()
    if specialist not in SPECIALISTS and specialist != "new":
        specialist = "shuri"
    mid = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    omega_db.mission_insert(mid, title[:500], STATUS_QUEUED, specialist, source, payload or {}, now, now)
    return mid


def assign_mission(mission_id: str, specialist: str) -> bool:
    """Set assigned_specialist and optionally move to IN_PROGRESS."""
    _ensure_db()
    import omega_db
    return omega_db.mission_update_specialist(mission_id, specialist.lower())


def start_mission(mission_id: str) -> bool:
    """Move mission to IN_PROGRESS (DOING)."""
    _ensure_db()
    import omega_db
    return omega_db.mission_update_status(mission_id, STATUS_IN_PROGRESS, progress=0.0)


def complete_mission(mission_id: str, result: str | None = None, progress: float = 1.0) -> bool:
    """Mark mission COMPLETED."""
    _ensure_db()
    import omega_db
    return omega_db.mission_update_status(mission_id, STATUS_COMPLETED, result=result, progress=progress)


def set_mission_progress(mission_id: str, progress: float) -> bool:
    _ensure_db()
    import omega_db
    return omega_db.mission_update_progress(mission_id, progress)


def get_queued_missions(specialist: str | None = None) -> list:
    data = load_state()
    status_ok = (STATUS_QUEUED, STATUS_PENDING)
    out = [m for m in data["missions"] if (m.get("status") or "").upper() in status_ok]
    if specialist:
        spec_lower = specialist.lower()
        out = [m for m in out if (m.get("assigned_specialist") or m.get("assignee") or "").lower() == spec_lower]
    return out


def get_in_progress_missions(specialist: str | None = None) -> list:
    data = load_state()
    out = [m for m in data["missions"] if (m.get("status") or "").upper() in (STATUS_IN_PROGRESS, STATUS_DOING)]
    if specialist:
        out = [m for m in out if (m.get("assigned_specialist") or "").lower() == specialist.lower()]
    return out


def get_completed_missions(limit: int = 50) -> list:
    data = load_state()
    out = [m for m in data["missions"] if (m.get("status") or "").upper() == STATUS_COMPLETED]
    out.sort(key=lambda x: x.get("updated_at") or "", reverse=True)
    return out[:limit]


# ——— Circuit Breaker ———
def _send_telegram_alert(text: str) -> None:
    """Send one-off Telegram alert (e.g. circuit breaker)."""
    import os
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
        urllib.request.urlopen(req, timeout=8)
    except Exception:
        pass


def record_spend(amount_eur: float) -> None:
    data = load_state()
    _reset_daily_if_needed(data["state"])
    was_ok = not data["state"].get("circuit_breaker_tripped") and (
        data["state"].get("daily_spend_eur", 0) < data["state"].get("spend_limit_eur", DEFAULT_SPEND_LIMIT_EUR)
    )
    data["state"]["daily_spend_eur"] = data["state"].get("daily_spend_eur", 0) + amount_eur
    if data["state"]["daily_spend_eur"] >= data["state"].get("spend_limit_eur", DEFAULT_SPEND_LIMIT_EUR):
        data["state"]["circuit_breaker_tripped"] = True
    save_state(data)
    if was_ok and data["state"].get("circuit_breaker_tripped"):
        _send_telegram_alert(
            f"⛔ Circuit Breaker: API-daglimiet bereikt (€{data['state']['daily_spend_eur']:.2f}). "
            "Geen betaalde API-calls tot morgen. Pas mission_control state.spend_limit_eur aan indien nodig."
        )


def circuit_breaker_ok() -> bool:
    """True if we may still call paid APIs."""
    data = load_state()
    _reset_daily_if_needed(data["state"])
    return not data["state"].get("circuit_breaker_tripped", False) and (
        data["state"].get("daily_spend_eur", 0) < data["state"].get("spend_limit_eur", DEFAULT_SPEND_LIMIT_EUR)
    )


def get_daily_spend() -> tuple[float, float]:
    data = load_state()
    _reset_daily_if_needed(data["state"])
    return data["state"].get("daily_spend_eur", 0), data["state"].get("spend_limit_eur", DEFAULT_SPEND_LIMIT_EUR)


def set_tunnel_url(url: str) -> None:
    data = load_state()
    data["state"]["tunnel_url"] = url
    save_state(data)


def get_tunnel_url() -> str:
    return load_state().get("state", {}).get("tunnel_url", "")


# ——— Architect Mode: create new specialist SOUL.md ———
def create_specialist(name: str, role: str, expertise: str, instructions: str) -> Path | None:
    """Jarvis: create new specialist agent (SOUL.md). Returns path or None."""
    name = name.lower().replace(" ", "_").strip("_")
    if not name:
        return None
    agent_dir = AGENTS_DIR / name
    agent_dir.mkdir(parents=True, exist_ok=True)
    soul = agent_dir / "SOUL.md"
    content = f"""# {name.title()} — Specialist

- **Role:** {role}
- **Expertise:** {expertise}

## Instructions

{instructions}

---
*Created by Jarvis (Architect Mode).*
"""
    soul.write_text(content, encoding="utf-8")
    return soul
