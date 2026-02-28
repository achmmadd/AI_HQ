"""Holding Overview — tenant cards, agent status, actieve taken."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import streamlit as st

st.set_page_config(page_title="Holding Overview", page_icon="🏢", layout="wide")
st.title("Holding Overview")

try:
    import omega_db
    omega_db.init_schema()
except Exception as e:
    st.error(f"Database niet beschikbaar: {e}")
    st.stop()

tenants = omega_db.tenant_list()
agents = omega_db.holding_agent_list()
tasks = omega_db.holding_task_list(limit=200)

if not tenants:
    st.info("Nog geen tenants. Gebruik `/holding seed` in Telegram of run `seed_tenants_and_agents()`.")
    st.stop()

cols = st.columns(len(tenants))
for i, tenant in enumerate(tenants):
    t_agents = [a for a in agents if a["tenant_id"] == tenant["id"]]
    t_tasks = [t for t in tasks if t["tenant_id"] == tenant["id"]]
    active = [t for t in t_tasks if t["status"] in ("pending", "in_progress", "review")]
    approved = [t for t in t_tasks if t["status"] == "approved"]

    with cols[i]:
        st.subheader(f"{tenant['name']}")
        st.caption(f"Type: {tenant['type']} | Industrie: {tenant.get('industry', '-')}")
        c1, c2, c3 = st.columns(3)
        c1.metric("Agents", len(t_agents))
        c2.metric("Actief", len(active))
        c3.metric("Goedgekeurd", len(approved))

        st.markdown("**Agents:**")
        for a in t_agents:
            status_icon = {"idle": "🟢", "busy": "🟡", "error": "🔴", "offline": "⚫"}.get(a["status"], "⚪")
            st.text(f"  {status_icon} {a['name']} ({a['role']})")

st.divider()
st.subheader("Recente taken")
recent = sorted(tasks, key=lambda t: t.get("created_at", ""), reverse=True)[:15]
if recent:
    for t in recent:
        status_color = {
            "pending": "🔵", "in_progress": "🟡", "review": "🟠",
            "approved": "🟢", "rejected": "🔴",
        }.get(t["status"], "⚪")
        st.text(f"{status_color} [{t['tenant_id']:10s}] {t['id']}: {t['title'][:60]} ({t['status']})")
else:
    st.info("Nog geen taken.")
