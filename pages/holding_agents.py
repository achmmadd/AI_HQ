"""Holding Agents — hiërarchie en performance per agent."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import streamlit as st

st.set_page_config(page_title="Holding Agents", page_icon="🤖", layout="wide")
st.title("Holding Agents")

try:
    import omega_db
    omega_db.init_schema()
except Exception as e:
    st.error(f"Database niet beschikbaar: {e}")
    st.stop()

tenants = omega_db.tenant_list()
agents = omega_db.holding_agent_list()
tasks = omega_db.holding_task_list(limit=500)

for tenant in tenants:
    st.subheader(tenant["name"])
    t_agents = [a for a in agents if a["tenant_id"] == tenant["id"]]

    manager = [a for a in t_agents if a["role"] == "manager"]
    workers = [a for a in t_agents if a["role"] == "werker"]
    auditors = [a for a in t_agents if a["role"] == "auditor"]

    if manager:
        st.markdown(f"**Manager:** {manager[0]['name']}")

    cols = st.columns(max(len(workers) + len(auditors), 1))
    for i, agent in enumerate(workers + auditors):
        with cols[i % len(cols)]:
            status_icon = {"idle": "🟢", "busy": "🟡", "error": "🔴", "offline": "⚫"}.get(agent["status"], "⚪")
            st.markdown(f"### {status_icon} {agent['name']}")
            st.caption(f"{agent['role']} | {agent.get('specialization', '-')} | model: {agent.get('model', '-')}")

            skills = agent.get("skills", [])
            if skills:
                st.text(f"Skills: {', '.join(skills)}")

            agent_tasks = [t for t in tasks if t.get("assigned_to") == agent["id"]]
            completed = [t for t in agent_tasks if t["status"] == "approved"]
            rejected = [t for t in agent_tasks if t["status"] == "rejected"]

            c1, c2, c3 = st.columns(3)
            c1.metric("Totaal", len(agent_tasks))
            c2.metric("Goedgekeurd", len(completed))
            c3.metric("Afgewezen", len(rejected))

            if completed:
                avg_conf = sum(t.get("confidence_score", 0) or 0 for t in completed) / len(completed)
                st.text(f"Gem. confidence: {avg_conf:.2f}")

    st.divider()
