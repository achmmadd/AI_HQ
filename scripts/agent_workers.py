"""
Omega Supremacy — Agent Workers.
Poll mission_control.json; pick QUEUED missions for each specialist and execute (placeholder: complete with result).
Runs as a daemon/container next to the bridge.
"""
import logging
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in __import__("sys").path:
    __import__("sys").path.insert(0, str(ROOT))

from mission_control import (
    start_mission,
    complete_mission,
    set_mission_progress,
    get_queued_missions,
    SPECIALISTS,
)

LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.FileHandler(LOG_DIR / "agent_workers.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

# Agent watcher: elke 10s mission_control.json inladen; status PENDING/QUEUED + assignee == Agent_Name → DOING → uitvoeren → COMPLETED
POLL_INTERVAL = 10
THOUGHT_TRACE = ROOT / "data" / "thought_trace.log"
MISSION_JSON_PATH = ROOT / "data" / "mission_control.json"
# Zelfde map als dashboard, ook buiten Docker (NUC)
OUTPUT_DIR = ROOT / "holding" / "output"


def _trace(msg: str) -> None:
    try:
        THOUGHT_TRACE.parent.mkdir(parents=True, exist_ok=True)
        with open(THOUGHT_TRACE, "a", encoding="utf-8") as f:
            from datetime import datetime, timezone
            f.write(f"[{datetime.now(timezone.utc).isoformat()}] {msg}\n")
    except Exception:
        pass


def execute_mission(mission: dict) -> None:
    """Execute mission; write report to holding/output/[task_id].md before COMPLETED."""
    mid = mission.get("id", "")
    title = mission.get("title", "?")
    specialist = (mission.get("assigned_specialist") or "shuri").lower()
    _trace(f"[{specialist}] Picked mission {mid}: {title[:50]}")
    if not start_mission(mid):
        return
    set_mission_progress(mid, 0.3)
    time.sleep(1)
    set_mission_progress(mid, 0.7)
    time.sleep(0.5)
    result = f"Afgehandeld door {specialist} (worker placeholder)."
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_md = OUTPUT_DIR / f"{mid}.md"
    out_md.write_text(
        f"# {title}\n\n**Specialist:** {specialist}\n\n**Resultaat:**\n\n{result}\n",
        encoding="utf-8",
    )
    complete_mission(mid, result=result, progress=1.0)
    _trace(f"[{specialist}] Completed {mid}: {result[:60]}")


def run():
    logger.info("Agent watchers started (poll %s every %ds by Agent_ID)", MISSION_JSON_PATH, POLL_INTERVAL)
    while True:
        try:
            print(f"[agent_workers] POLL READ {MISSION_JSON_PATH}", flush=True)
            for spec in SPECIALISTS:
                if spec == "jarvis":
                    continue
                queued = get_queued_missions(specialist=spec)
                for m in queued[:1]:
                    execute_mission(m)
                    break
        except Exception as e:
            logger.exception("Worker cycle: %s", e)
        time.sleep(POLL_INTERVAL)


if __name__ == "__main__":
    run()
