"""
Omega AI-Holding — Heartbeat daemon.
Logt periodiek dat de holding actief is (omega_db). Start via launch_factory.sh.
"""
import logging
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
LOG_DIR = ROOT / "logs"
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.FileHandler(LOG_DIR / "heartbeat.log"), logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

INTERVAL = 60  # seconden


def _append_heartbeat():
    """Schrijf één punt naar omega_db voor System Heartbeat-graph (dashboard)."""
    try:
        import omega_db
        omega_db.init_schema()
        omega_db.heartbeat_append(int(time.time()), 1)
    except Exception as e:
        logger.debug("Heartbeat history: %s", e)


if __name__ == "__main__":
    logger.info("Heartbeat gestart (interval %ds)", INTERVAL)
    while True:
        try:
            time.sleep(INTERVAL)
            _append_heartbeat()
            logger.info("Heartbeat OK")
        except KeyboardInterrupt:
            logger.info("Heartbeat gestopt")
            break
