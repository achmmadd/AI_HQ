"""
Omega Mission Control — OpenClaw + Mission Control Hybrid.
Deep Space Obsidian theme, Liquid Glass, Agent Kanban, System Vitals, Hacker Terminal.
"""
import json
import os
import subprocess
import uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta
import time

import streamlit as st

ROOT = Path(__file__).resolve().parent
# Mission control en heartbeat uit omega_db (data/omega.db)
MISSION_CONTROL_JSON = ROOT / "data" / "mission_control.json"  # legacy; wordt niet meer geschreven
OUTPUT_DIR = os.environ.get("MISSION_OUTPUT_DIR") or (ROOT / "holding" / "output")
if isinstance(OUTPUT_DIR, Path):
    OUTPUT_DIR = str(OUTPUT_DIR)
LOCKDOWN_FLAG = ROOT / "data" / "lockdown.flag"
MISSIONS_FILE = ROOT / "data" / "missions.json"
THOUGHT_TRACE_FILE = ROOT / "data" / "thought_trace.log"
OVERHEAT_FLAG = ROOT / "data" / "overheat.flag"
HOLDING_DIR = ROOT / "holding"


try:
    out_dir = ROOT / "holding" / "output"
    if out_dir.exists():
        os.system(f"chmod -R 777 {out_dir} >/dev/null 2>&1")
    if os.path.exists("/app/output"):
        os.system("chmod -R 777 /app/output >/dev/null 2>&1")
except Exception:
    pass

def _read_mission_control_fresh():
    """Lees mission state uit omega_db (geen cache)."""
    try:
        from mission_control import load_state
        return load_state()
    except Exception:
        return {"missions": [], "state": {}}


# ——— OpenClaw mission_control (geen @st.cache — cache uit voor live data) ———
def _load_mc_state():
    return _read_mission_control_fresh()

def _mc_queued(): return [m for m in _load_mc_state().get("missions", []) if m.get("status") == "QUEUED"]
def _mc_in_progress(): return [m for m in _load_mc_state().get("missions", []) if m.get("status") == "IN_PROGRESS"]
def _mc_completed(limit=20): return sorted([m for m in _load_mc_state().get("missions", []) if m.get("status") == "COMPLETED"], key=lambda x: x.get("updated_at") or "", reverse=True)[:limit]

# ——— Legacy missions (fallback) ———
def _load_missions():
    mc = _load_mc_state()
    missions = mc.get("missions", [])
    if missions:
        q = (lambda s: (s or "").upper() in ("QUEUED", "PENDING"))
        return {
            "queue": [m for m in missions if q(m.get("status"))],
            "in_progress": [m for m in missions if (m.get("status") or "").upper() in ("IN_PROGRESS", "DOING")],
            "completed": [m for m in missions if (m.get("status") or "").upper() == "COMPLETED"],
        }
    if not MISSIONS_FILE.exists():
        return {"queue": [], "in_progress": [], "completed": []}
    try:
        return json.loads(MISSIONS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {"queue": [], "in_progress": [], "completed": []}

def _save_missions(data: dict):
    MISSIONS_FILE.parent.mkdir(parents=True, exist_ok=True)
    MISSIONS_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")

def add_mission_to_queue(title: str, source: str = "manual"):
    try:
        from mission_control import add_mission
        add_mission(title[:500], source=source)
        return
    except Exception:
        pass
    data = _load_missions()
    if isinstance(data.get("queue"), list):
        data["queue"].append({
            "id": str(uuid.uuid4())[:8],
            "title": title,
            "source": source,
            "created": datetime.now(timezone.utc).isoformat(),
        })
        _save_missions(data)

# ——— BU names ———
def _bu_names_from_holding():
    if not HOLDING_DIR.exists():
        return ("marketing", "app_studio", "finance")
    skip = {"agents", "data", "__pycache__"}
    dirs = [d.name for d in HOLDING_DIR.iterdir() if d.is_dir() and not d.name.startswith(".") and d.name not in skip]
    return tuple(sorted(dirs)) if dirs else ("marketing", "app_studio", "finance")

def BU_NAMES():
    return _bu_names_from_holding()

# ——— Deep Space Obsidian + Liquid Glass + JetBrains Mono / Inter ———
CSS = """
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root { --obsidian: #05070a; --glass: rgba(12, 14, 22, 0.65); --neon: #00ffc8; --neon-dim: rgba(0, 255, 200, 0.4); --danger: #ff3366; }
  .stApp { background: var(--obsidian); font-family: 'Inter', sans-serif; }
  [data-testid="stSidebar"] {
    background: var(--glass);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    border-right: 1px solid var(--neon-dim);
    font-family: 'Inter', sans-serif;
  }
  .mc-header {
    background: var(--glass);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    border: 1px solid var(--neon-dim);
    border-radius: 10px;
    padding: 0.6rem 1rem;
    margin-bottom: 1rem;
    display: flex;
    flex-wrap: wrap;
    gap: 1.5rem;
    align-items: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.85rem;
  }
  .mc-header span { color: #8c8c9c; }
  .mc-header .val { color: var(--neon); text-shadow: 0 0 10px var(--neon-dim); }
  .mc-header .ok { color: #00ff88; }
  .mc-header .warn { color: #ffaa00; }
  .mc-vitals {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  .mc-vital {
    background: var(--glass);
    backdrop-filter: blur(30px);
    border: 1px solid var(--neon-dim);
    border-radius: 10px;
    padding: 0.75rem 1.25rem;
    min-width: 120px;
    text-align: center;
    box-shadow: 0 0 25px var(--neon-dim);
  }
  .mc-vital .label { font-family: 'Inter', sans-serif; color: #6c6c7c; font-size: 0.75rem; }
  .mc-vital .value { font-family: 'JetBrains Mono', monospace; color: var(--neon); font-size: 1.4rem; text-shadow: 0 0 12px var(--neon-dim); }
  .mc-card {
    background: var(--glass);
    backdrop-filter: blur(30px);
    -webkit-backdrop-filter: blur(30px);
    border: 1px solid var(--neon-dim);
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1rem;
    box-shadow: 0 0 30px rgba(0,255,200,0.06);
  }
  .mc-card.agent { border-left: 4px solid var(--neon); }
  .mc-card.agent.thinking { animation: pulse-border 1.5s ease-in-out infinite; }
  .mc-card.agent.status-ok .status-dot { background: #00ff88; box-shadow: 0 0 12px #00ff88; }
  .mc-card.agent.status-fail .status-dot { background: var(--danger); box-shadow: 0 0 12px var(--danger); }
  @keyframes pulse-border { 0%, 100% { box-shadow: 0 0 20px var(--neon-dim); } 50% { box-shadow: 0 0 35px rgba(0,255,200,0.3); } }
  .status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 0.5rem; }
  .pill { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-family: 'JetBrains Mono', monospace; background: rgba(0,255,200,0.15); color: var(--neon); margin: 0.2rem; }
  .kanban-col { background: var(--glass); backdrop-filter: blur(30px); border: 1px solid var(--neon-dim); border-radius: 10px; padding: 0.75rem; min-height: 120px; }
  .mission-item { font-family: 'JetBrains Mono', monospace; font-size: 0.8rem; padding: 0.4rem; margin-bottom: 0.4rem; background: rgba(0,0,0,0.3); border-radius: 6px; color: #e0e0e0; }
  .overheat-flash { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(255,51,102,0.15); pointer-events: none; animation: flash 0.8s ease-in-out infinite; z-index: 9999; }
  @keyframes flash { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
  .hacker-terminal {
    font-family: 'JetBrains Mono', monospace;
    background: rgba(0,5,10,0.95);
    border: 1px solid var(--neon-dim);
    border-radius: 8px;
    padding: 0.75rem;
    color: #00ff88;
    text-shadow: 0 0 8px rgba(0,255,136,0.5);
    font-size: 0.8rem;
    max-height: 220px;
    overflow-y: auto;
  }
  .omega-card { background: var(--glass); backdrop-filter: blur(30px); border: 1px solid var(--neon-dim); border-radius: 12px; padding: 1rem; margin-bottom: 1rem; }
  .omega-card .value { font-family: 'JetBrains Mono', monospace; color: var(--neon); font-size: 1.5rem; }
  .omega-card .value.ok { color: #00ff88; }
  .omega-card .value.fail { color: var(--danger); }
  .omega-section { color: #8c8c9c; font-size: 0.85rem; }
  .lockdown-btn { background: var(--danger) !important; color: #fff !important; border: none !important; font-weight: bold; }
  h1, h2, h3 { font-family: 'Inter', sans-serif; color: #e8e8e8; }
  .stMarkdown p, .stCaption { color: #8c8c9c; font-family: 'Inter', sans-serif; }
</style>
"""


def _daemon_running(pattern: str, exclude: str | None = None) -> bool:
    try:
        out = subprocess.run(["pgrep", "-f", pattern], capture_output=True, text=True, timeout=5, cwd=str(ROOT))
        pids = [p.strip() for p in (out.stdout or "").strip().splitlines() if p.strip()]
        if not pids:
            return False
        if not exclude:
            return True
        for pid in pids:
            try:
                with open(f"/proc/{pid}/cmdline", encoding="utf-8", errors="ignore") as f:
                    cmd = f.read().replace("\x00", " ")
                if exclude not in cmd:
                    return True
            except (OSError, ValueError, FileNotFoundError):
                return True
        return False
    except Exception:
        return False


def _lockdown_active():
    return LOCKDOWN_FLAG.exists()


def _set_lockdown(active: bool):
    (ROOT / "data").mkdir(parents=True, exist_ok=True)
    if active:
        LOCKDOWN_FLAG.write_text(datetime.now(timezone.utc).isoformat())
    elif LOCKDOWN_FLAG.exists():
        LOCKDOWN_FLAG.unlink()


def _tunnel_active() -> bool:
    try:
        r = subprocess.run(["docker", "inspect", "--format", "{{.State.Running}}", "omega-cloudflared"], capture_output=True, text=True, timeout=5, cwd=str(ROOT))
        return r.returncode == 0 and "true" in (r.stdout or "").lower()
    except Exception:
        return False


# ——— Evomap (Marketing Swarm) ———
def _evomap_base_url():
    base = os.environ.get("EVOMAP_API_URL") or ""
    if base:
        return base.rstrip("/")
    env_file = ROOT / ".env"
    if env_file.is_file():
        try:
            for line in env_file.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, _, v = line.partition("=")
                    if k.strip() == "EVOMAP_API_URL" and v.strip():
                        return v.strip().strip("'\"").rstrip("/")
        except Exception:
            pass
    return "http://localhost:8000"


def _evomap_fetch(path: str):
    """GET van Evomap API; retourneert (data, error)."""
    base = _evomap_base_url()
    url = f"{base}{path}"
    try:
        import urllib.request
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=5) as resp:
            if 200 <= resp.status < 300:
                import json
                return json.loads(resp.read().decode("utf-8")), None
            return None, f"Status {resp.status}"
    except Exception as e:
        return None, str(e)


st.set_page_config(page_title="Omega Mission Control", page_icon="🛸", layout="wide", initial_sidebar_state="expanded")
st.markdown(CSS, unsafe_allow_html=True)
try:
    from streamlit_autorefresh import st_autorefresh
    st_autorefresh(interval=5000, key="mc_autorefresh")
except Exception:
    pass

# ——— Host metrics (1Panel) voor header + vitals + overheat ———
temp_c = None
load_pct = 0.0
ram_pct = None
try:
    from omega_1panel_bridge import get_host_metrics, get_host_stats
    m = get_host_metrics()
    temp_c = m.get("temp_c")
    load_pct = m.get("load_pct") or 0.0
    stats = get_host_stats()
    if stats.get("ok") and stats.get("data"):
        inner = (stats["data"].get("data") or stats["data"]) if isinstance(stats["data"], dict) else {}
        if isinstance(inner, dict) and "memoryUsed" in inner:
            used = inner.get("memoryUsed") or 0
            total = inner.get("memoryTotal") or inner.get("memTotal") or 1
            if total:
                ram_pct = round((used / total) * 100, 1)
except Exception:
    pass

# ——— Overheat: rood flikkeren + Telegram (Resource Warden doet al Telegram; we tonen alleen flash) ———
if temp_c is not None and float(temp_c) > 80:
    (ROOT / "data").mkdir(parents=True, exist_ok=True)
    OVERHEAT_FLAG.write_text(datetime.now(timezone.utc).isoformat())
    st.markdown('<div class="overheat-flash"></div>', unsafe_allow_html=True)
elif OVERHEAT_FLAG.exists():
    OVERHEAT_FLAG.unlink(missing_ok=True)

# ——— Global Header Bar ———
system_ok = _daemon_running("telegram_bridge.py", "--zwartehand") and _daemon_running("heartbeat.py")
temp_str = f"{temp_c:.0f}°C" if temp_c is not None else "—"
temp_class = "warn" if (temp_c is not None and temp_c > 70) else "val"
tunnel_status = "Active" if _tunnel_active() else "Off"
try:
    from mission_control import get_daily_spend, get_tunnel_url
    spend, limit = get_daily_spend()
    costs_today = f"€{spend:.2f} / €{limit:.0f}"
except Exception:
    costs_today = "€0.00 / €10"
st.markdown(f'''
<div class="mc-header">
  <span>System Status:</span> <span class="val {'ok' if system_ok else 'warn'}">{"Healthy" if system_ok else "Degraded"}</span>
  <span>|</span>
  <span>NUC Temp:</span> <span class="{temp_class}">{temp_str}</span>
  <span>|</span>
  <span>Tunnel:</span> <span class="val">{tunnel_status}</span>
  <span>|</span>
  <span>Total Costs Today:</span> <span class="val">{costs_today}</span>
</div>
''', unsafe_allow_html=True)

# ——— System Vitals Row (OpenClaw style) ———
st.markdown('<div class="mc-vitals">', unsafe_allow_html=True)
v1, v2, v3 = st.columns(3)
with v1:
    st.markdown(f'<div class="mc-vital"><div class="label">CPU Load</div><div class="value">{load_pct:.1f}%</div></div>', unsafe_allow_html=True)
with v2:
    ram_str = f"{ram_pct}%" if ram_pct is not None else "—"
    st.markdown(f'<div class="mc-vital"><div class="label">RAM</div><div class="value">{ram_str}</div></div>', unsafe_allow_html=True)
with v3:
    st.markdown('<div class="mc-vital"><div class="label">API Latency</div><div class="value">— ms</div></div>', unsafe_allow_html=True)
st.markdown('</div>', unsafe_allow_html=True)

# ——— Sidebar + page ———
bu_list = BU_NAMES()
try:
    import streamlit_antd_components as sac
    menu_items = [
        sac.MenuItem("Mission Control", icon="speedometer2"),
        sac.MenuItem("Missions", icon="kanban"),
        sac.MenuItem("Agents", icon="person-badge"),
        sac.MenuItem("Server Health", icon="cpu"),
        sac.MenuItem("Data", icon="folder"),
        sac.MenuItem("divider", type="divider"),
    ]
    for bu in bu_list:
        menu_items.append(sac.MenuItem(bu.replace("_", " ").title(), icon="building", key=bu))
    menu_items.extend([sac.MenuItem("divider2", type="divider"), sac.MenuItem("BU's", icon="building-add"), sac.MenuItem("Logs", icon="journal-text"), sac.MenuItem("Links", icon="link")])
    with st.sidebar:
        st.markdown("## 🛸 Mission Control")
        st.markdown("---")
        selected = sac.menu(menu_items, format_func="title", return_index=False, key="sac_nav")
        if selected and selected not in ("divider", "divider2"):
            page = f"BU:{selected}" if selected in bu_list else ("Missions" if selected == "Missions" else ("Agents" if selected == "Agents" else selected))
        else:
            page = "Mission Control"
except Exception:
    with st.sidebar:
        st.markdown("## 🛸 Mission Control")
        opts = ["Mission Control", "Missions", "Agents", "Evomap", "Server Health", "Data"] + [f"BU:{b}" for b in bu_list] + ["BU's", "Logs", "Links"]
        page = st.radio("Nav", opts, label_visibility="collapsed", key="nav")

with st.sidebar:
    st.markdown("---")
    if _lockdown_active():
        st.error("🔒 Lockdown actief")
        if st.button("Lockdown opheffen"):
            _set_lockdown(False)
            st.rerun()
    else:
        if st.button("🚨 EMERGENCY LOCKDOWN", type="primary", use_container_width=True):
            _set_lockdown(True)
            st.rerun()
    if st.button("🔄 Forceer Systeem Refresh", use_container_width=True):
        st.rerun()
    st.caption("OpenClaw × Mission Control")

# ——— Main: Mission Control (default) ———
if page == "Mission Control":
    st.title("Mission Control")
    st.caption("Agent Orchestration — Deep Space Obsidian")

    # Live sync: elke refresh (5s) JSON VERS inlezen — GEEN cache, pad = /app/data in container
    with st.spinner("Missions laden…"):
        tasks_data = _read_mission_control_fresh()
    missions_list = tasks_data.get("missions", [])
    q = lambda s: (s or "").upper() in ("QUEUED", "PENDING")
    queue = [m for m in missions_list if q(m.get("status"))]
    in_progress = [m for m in missions_list if (m.get("status") or "").upper() in ("IN_PROGRESS", "DOING")]
    completed = sorted([m for m in missions_list if (m.get("status") or "").upper() == "COMPLETED"], key=lambda x: x.get("updated_at") or "", reverse=True)[:10]
    use_mc = bool(missions_list)

    col_q, col_ip, col_done = st.columns(3)
    place_q = col_q.empty()
    place_ip = col_ip.empty()
    place_done = col_done.empty()

    with place_q.container():
        st.markdown("**📋 Queue**")
        for m in queue:
            mid = m.get("id", "")
            title = (m.get("title") or "?")[:40]
            spec = (m.get("assigned_specialist") or "") and f" → {m.get('assigned_specialist', '')}"
            st.markdown(f'<div class="mission-item">{title}{spec}</div>', unsafe_allow_html=True)
            if st.button("→ Start", key=f"start_{mid}"):
                if use_mc:
                    try:
                        from mission_control import start_mission
                        start_mission(mid)
                    except Exception:
                        pass
                st.rerun()
    with place_ip.container():
        st.markdown("**⚡ In Progress**")
        for m in in_progress:
            mid = m.get("id", "")
            title = (m.get("title") or "?")[:40]
            p = float(m.get("progress", 0))
            st.progress(p)
            st.markdown(f'<div class="mission-item">{title}</div>', unsafe_allow_html=True)
            if st.button("✓ Done", key=f"done_{mid}"):
                if use_mc:
                    try:
                        from mission_control import complete_mission
                        complete_mission(mid, result="Done via dashboard")
                    except Exception:
                        pass
                st.rerun()
    with place_done.container():
        st.markdown("**✅ Completed**")
        for m in completed:
            task_id = m.get("id")
            title = (m.get("title") or m.get("task") or "?")[:35]
            report_path = os.path.join(OUTPUT_DIR, f"{task_id}.md") if task_id else None
            with st.container():
                st.markdown(f"### ✅ {title}")
                if task_id and report_path and os.path.exists(report_path):
                    with st.expander("📄 Open Volledig Rapport", expanded=False):
                        try:
                            with open(report_path, "r", encoding="utf-8", errors="ignore") as f:
                                st.markdown(f.read())
                        except Exception:
                            st.info("Kon rapport niet laden.")
                else:
                    st.info("Rapport wordt gegenereerd of bestand niet gevonden.")

    # Squad: Jarvis, Shuri, Vision, Friday
    st.markdown("---")
    st.markdown("### Squad")
    jarvis_ok = _daemon_running("telegram_bridge.py", "--zwartehand")
    eng_ok = _daemon_running("engineer_daemon")
    thinking = len(in_progress) > 0
    c1, c2, c3, c4 = st.columns(4)
    with c1:
        st.markdown(f'<div class="mc-card agent status-{"ok" if jarvis_ok else "fail"} {"thinking" if thinking else ""}"><span class="status-dot"></span><strong>Jarvis</strong> — CEO / Orchestrator<br><span class="pill">Delegatie</span></div>', unsafe_allow_html=True)
    with c2:
        st.markdown('<div class="mc-card agent status-ok"><span class="status-dot"></span><strong>Shuri</strong> — Research & RAG<br><span class="pill">Gemini</span></div>', unsafe_allow_html=True)
    with c3:
        st.markdown('<div class="mc-card agent status-ok"><span class="status-dot"></span><strong>Vision</strong> — Viral Content<br><span class="pill">TikTok/SEO</span></div>', unsafe_allow_html=True)
    with c4:
        st.markdown(f'<div class="mc-card agent status-{"ok" if eng_ok else "fail"}"><span class="status-dot"></span><strong>Friday</strong> — Engineer<br><span class="pill">Docker/NUC</span></div>', unsafe_allow_html=True)

    # System Heartbeat (omega_db)
    st.markdown("### System Heartbeat")
    try:
        import omega_db
        omega_db.init_schema()
        points = omega_db.heartbeat_list(limit=24 * 60)
        if points:
            cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).timestamp()
            points = [p for p in points if p.get("ts", 0) >= cutoff]
            if points:
                import pandas as pd
                df = pd.DataFrame(points)
                df["time"] = pd.to_datetime(df["ts"], unit="s")
                st.line_chart(df.set_index("time")[["ok"]])
    except Exception:
        pass

    # Hacker Terminal (Thought Trace)
    with st.expander("🖥️ Live Log — Thought Trace", expanded=False):
        if THOUGHT_TRACE_FILE.exists():
            lines = THOUGHT_TRACE_FILE.read_text(encoding="utf-8", errors="ignore").strip().splitlines()[-60:]
            st.markdown(f'<pre class="hacker-terminal">{"".join(l + chr(10) for l in lines)}</pre>', unsafe_allow_html=True)
        else:
            for log in ["engineer.log", "telegram_bridge.log"]:
                p = ROOT / "logs" / log
                if p.exists():
                    lines = p.read_text(encoding="utf-8", errors="ignore").strip().splitlines()[-25:]
                    st.markdown(f'<pre class="hacker-terminal">[{log}]\n{"".join(l + chr(10) for l in lines)}</pre>', unsafe_allow_html=True)
                    break
            else:
                st.caption("Geen thought trace. Agents schrijven naar data/thought_trace.log")
        if st.button("Ververs log"):
            st.rerun()

elif page == "Missions":
    st.title("Active Missions")
    missions = _load_missions()
    new = st.text_input("Nieuwe missie toevoegen aan Queue")
    if st.button("Toevoegen") and new:
        add_mission_to_queue(new.strip(), "manual")
        st.rerun()
    col_q, col_ip, col_done = st.columns(3)
    with col_q:
        st.subheader("Queue")
        for m in missions["queue"]:
            st.write(m.get("title", "?"))
    with col_ip:
        st.subheader("In Progress")
        for m in missions["in_progress"]:
            st.write(m.get("title", "?"))
            st.progress(m.get("progress", 0))
    with col_done:
        st.subheader("Completed")
        for m in missions["completed"][-15:]:
            st.caption(m.get("title", "?"))

elif page == "Agents":
    st.title("Squad")
    jarvis_ok = _daemon_running("telegram_bridge.py", "--zwartehand")
    eng_ok = _daemon_running("engineer_daemon")
    st.markdown(f'<div class="mc-card agent status-{"ok" if jarvis_ok else "fail"}"><span class="status-dot"></span><strong>Jarvis</strong> — CEO / Orchestrator</div>', unsafe_allow_html=True)
    st.markdown('<div class="mc-card agent status-ok"><span class="status-dot"></span><strong>Shuri</strong> — Research & RAG</div>', unsafe_allow_html=True)
    st.markdown('<div class="mc-card agent status-ok"><span class="status-dot"></span><strong>Vision</strong> — Viral Content</div>', unsafe_allow_html=True)
    st.markdown(f'<div class="mc-card agent status-{"ok" if eng_ok else "fail"}"><span class="status-dot"></span><strong>Friday</strong> — Engineer</div>', unsafe_allow_html=True)
    model = st.selectbox("Model (standaard)", ["GPT-4o", "DeepSeek-V3", "Llama-3", "Gemini"], key="agent_model")

elif page == "Evomap":
    st.title("Marketing Swarm (Evomap)")
    st.caption("Omega + 5 marketing-agenten · Live status uit Evomap-backend")
    agents_data, err_agents = _evomap_fetch("/api/agents")
    edges_data, err_edges = _evomap_fetch("/api/edges")
    if err_agents:
        st.warning(f"Evomap-backend niet bereikbaar: {err_agents}. Start Evomap (bijv. `cd evomap && docker compose up -d`) of zet EVOMAP_API_URL in .env.")
    else:
        agents = agents_data if isinstance(agents_data, list) else []
        edges = edges_data if isinstance(edges_data, list) else []
        status_css = {"idle": "ok", "busy": "warn", "success": "ok", "error": "fail"}
        if agents:
            cols = st.columns(min(len(agents), 3))
            for i, a in enumerate(agents):
                with cols[i % len(cols)]:
                    aid = a.get("id", "")
                    name = a.get("name", aid)
                    task = (a.get("current_task") or "")[:50]
                    status = (a.get("status") or "idle").lower()
                    sc = status_css.get(status, "ok")
                    st.markdown(
                        f'<div class="mc-card agent status-{sc}"><span class="status-dot"></span><strong>{name}</strong><br><span class="pill">{status}</span>{(" · " + task) if task else ""}</div>',
                        unsafe_allow_html=True,
                    )
        if edges:
            st.markdown("**Verbindingen**")
            st.caption(" · ".join([f"{e.get('source', '?')} → {e.get('target', '?')}" for e in edges[:15]]))
        if st.button("Ververs Evomap", key="evomap_refresh"):
            st.rerun()

elif page == "Server Health":
    st.markdown("### 1Panel — Real-time metrics")
    try:
        from omega_1panel_bridge import get_host_stats, container_list
        host = get_host_stats()
        if host.get("ok") and host.get("data"):
            inner = (host["data"].get("data") or host["data"]) if isinstance(host["data"], dict) else {}
            if isinstance(inner, dict):
                c1, c2, c3 = st.columns(3)
                with c1:
                    st.metric("OS", (inner.get("os") or "-") + " / " + (inner.get("platform") or "-"))
                with c2:
                    st.metric("Kernel", (str(inner.get("kernelVersion") or "-"))[:30])
                with c3:
                    gb = (inner.get("diskSize") or 0) / (1024**3)
                    st.metric("Schijf", f"{gb:.1f} GB")
        cl = container_list()
        if cl.get("ok") and cl.get("data"):
            st.json(cl["data"])
    except Exception as e:
        st.warning(str(e))

elif page == "Data":
    tasks_dir = ROOT / "data" / "tasks"
    notes_dir = ROOT / "data" / "notes"
    n_tasks = len(list(tasks_dir.glob("task_*.json"))) if tasks_dir.exists() else 0
    n_notes = len(list(notes_dir.glob("*.txt"))) if notes_dir.exists() else 0
    st.metric("Open taken", n_tasks)
    st.metric("Notities", n_notes)

elif page == "BU's":
    st.markdown("### Business Units")
    model_file = ROOT / "data" / "model_switcher.json"
    try:
        current = json.loads(model_file.read_text(encoding="utf-8")).get("model", "Gemini") if model_file.exists() else "Gemini"
    except Exception:
        current = "Gemini"
    selected = st.selectbox("Model (BU's)", ["Gemini", "OpenAI", "Ollama"], index=["Gemini", "OpenAI", "Ollama"].index(current) if current in ["Gemini", "OpenAI", "Ollama"] else 0, key="bu_model")
    (ROOT / "data").mkdir(parents=True, exist_ok=True)
    model_file.write_text(json.dumps({"model": selected}, indent=2), encoding="utf-8")
    for bu in bu_list:
        bu_dir = ROOT / "holding" / bu
        with st.expander(bu, expanded=False):
            st.caption(f"holding/{bu}/")
            if (bu_dir / "profile.json").exists():
                st.json(json.loads((bu_dir / "profile.json").read_text(encoding="utf-8")))

elif page.startswith("BU:"):
    bu = page.replace("BU:", "", 1)
    st.title(f"BU — {bu.replace('_', ' ').title()}")
    st.caption(f"holding/{bu}/")

elif page == "Logs":
    log_file = st.selectbox("Log", ["telegram_bridge.log", "engineer.log", "agent_workers.log", "streamlit.log", "heartbeat.log", "resource_warden.log", "thought_trace.log"], key="log_sel")
    path = (ROOT / "data" / "thought_trace.log") if log_file.startswith("thought") else (ROOT / "logs" / log_file)
    if path.exists():
        lines = path.read_text(encoding="utf-8", errors="ignore").strip().splitlines()[-80:]
        st.markdown(f'<pre class="hacker-terminal">{"".join(l + chr(10) for l in lines)}</pre>', unsafe_allow_html=True)
    else:
        st.caption("Log nog niet aangemaakt.")
    if st.button("Ververs"):
        st.rerun()

else:
    st.markdown("### Links")
    try:
        from mission_control import get_tunnel_url
        url = get_tunnel_url()
        if url:
            st.markdown(f"**Mission Control (tunnel):** {url}")
        else:
            st.markdown("Tunnel-URL: stuur /tunnel in Telegram om de link op te slaan.")
    except Exception:
        pass
    st.markdown("Dashboard: http://localhost:8501 · Telegram: /panel, /tunnel, /lockdown")
