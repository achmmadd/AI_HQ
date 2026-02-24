"""
Eenmalige migratie: mission_control.json, data/tasks/*.json, data/notes/*.txt,
pending_approvals.json, heartbeat_history.json → data/omega.db.
Draai vanuit projectroot: python scripts/migrate_json_to_sqlite.py
"""
import json
import sys
from pathlib import Path
from datetime import date

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from omega_db import init_schema, mission_insert, state_set, task_insert, note_insert, approval_set, heartbeat_append
from mission_control import DEFAULT_SPEND_LIMIT_EUR


def migrate_mission_control():
    path = ROOT / "data" / "mission_control.json"
    if not path.exists():
        print("Geen mission_control.json gevonden; skip.")
        return
    data = json.loads(path.read_text(encoding="utf-8"))
    missions = data.get("missions") or []
    state = data.get("state") or {}
    state.setdefault("daily_spend_eur", 0.0)
    state.setdefault("spend_limit_eur", DEFAULT_SPEND_LIMIT_EUR)
    state.setdefault("last_reset_date", date.today().isoformat())
    state.setdefault("circuit_breaker_tripped", False)
    state.setdefault("tunnel_url", "")
    for k, v in state.items():
        state_set(k, v)
    for m in missions:
        mid = m.get("id") or ""
        title = m.get("title") or ""
        status = (m.get("status") or "QUEUED").upper()
        specialist = (m.get("assigned_specialist") or m.get("assignee") or "shuri").lower()
        source = m.get("source") or "telegram"
        payload = m.get("payload") or {}
        created = m.get("created_at") or m.get("updated_at") or ""
        updated = m.get("updated_at") or created
        if not mid or not created:
            continue
        try:
            mission_insert(mid, title, status, specialist, source, payload, created, updated)
        except Exception as e:
            print("Mission skip", mid, e)
    print("mission_control: state +", len(missions), "missions")


def migrate_tasks():
    tasks_dir = ROOT / "data" / "tasks"
    if not tasks_dir.exists():
        print("Geen data/tasks; skip.")
        return
    n = 0
    for path in sorted(tasks_dir.glob("task_*.json")):
        try:
            d = json.loads(path.read_text(encoding="utf-8"))
            task_id = d.get("id") or path.stem
            desc = d.get("description") or ""
            prio = d.get("prioriteit") or "normaal"
            status = d.get("status") or "open"
            created = d.get("created") or ""
            if not created:
                continue
            completed = d.get("completed") if status == "done" else None
            task_insert(task_id, desc, prio, status, created, completed)
            n += 1
        except Exception as e:
            print("Task skip", path.name, e)
    print("tasks:", n)


def migrate_notes():
    notes_dir = ROOT / "data" / "notes"
    if not notes_dir.exists():
        print("Geen data/notes; skip.")
        return
    n = 0
    for path in sorted(notes_dir.glob("*.txt"), key=lambda p: p.stat().st_mtime, reverse=True):
        try:
            content = path.read_text(encoding="utf-8")
            note_id = path.name
            title = path.stem
            if "_" in title:
                title = title.split("_", 2)[-1].replace("_", " ").strip()
            if content.startswith("# "):
                first_line, _, rest = content.lstrip().split("\n", 2) if "\n" in content.lstrip() else (content.strip(), "", "")
                title = first_line[2:].strip() or title
                content = rest if rest else content
            created = path.stat().st_mtime
            from datetime import datetime, timezone
            created_at = datetime.fromtimestamp(created, tz=timezone.utc).isoformat().replace("+00:00", "Z")
            note_insert(note_id, title, content, created_at)
            n += 1
        except Exception as e:
            print("Note skip", path.name, e)
    print("notes:", n)


def migrate_pending_approvals():
    path = ROOT / "data" / "pending_approvals.json"
    if not path.exists():
        print("Geen pending_approvals.json; skip.")
        return
    data = json.loads(path.read_text(encoding="utf-8"))
    by_chat = data.get("by_chat") or {}
    for chat_id, pending in by_chat.items():
        try:
            approval_id = pending.get("approval_id") or ""
            description = pending.get("description") or ""
            action = pending.get("action") or {}
            created = pending.get("created") or ""
            if approval_id and description and action and created:
                approval_set(chat_id, approval_id, description, action, created)
        except Exception as e:
            print("Approval skip", chat_id, e)
    print("pending_approvals:", len(by_chat))


def migrate_heartbeat():
    path = ROOT / "data" / "heartbeat_history.json"
    if not path.exists():
        print("Geen heartbeat_history.json; skip.")
        return
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        print("heartbeat_history geen lijst; skip.")
        return
    for p in data[- (24 * 60) :]:
        if isinstance(p, dict) and "ts" in p:
            heartbeat_append(int(p["ts"]), 1 if p.get("ok", 1) else 0)
    print("heartbeat_history:", len(data))


def main():
    ROOT.mkdir(exist_ok=True)
    (ROOT / "data").mkdir(parents=True, exist_ok=True)
    print("Initialiseren schema omega.db ...")
    init_schema()
    migrate_mission_control()
    migrate_tasks()
    migrate_notes()
    migrate_pending_approvals()
    migrate_heartbeat()
    print("Migratie afgerond. Oude bestanden blijven staan als backup.")


if __name__ == "__main__":
    main()
