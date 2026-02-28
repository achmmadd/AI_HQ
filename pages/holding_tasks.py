"""Holding Tasks — pipeline view per tenant (pending/in_progress/review/done)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import streamlit as st

st.set_page_config(page_title="Holding Tasks", page_icon="📋", layout="wide")
st.title("Holding Tasks")

try:
    import omega_db
    omega_db.init_schema()
except Exception as e:
    st.error(f"Database niet beschikbaar: {e}")
    st.stop()

tenants = omega_db.tenant_list()
tenant_ids = ["alle"] + [t["id"] for t in tenants]
selected = st.selectbox("Tenant", tenant_ids, index=0)

tid = None if selected == "alle" else selected
tasks = omega_db.holding_task_list(tenant_id=tid, limit=100)

if not tasks:
    st.info("Geen taken gevonden.")
    st.stop()

statuses = ["pending", "in_progress", "review", "approved", "rejected"]
cols = st.columns(len(statuses))

for col, status in zip(cols, statuses):
    filtered = [t for t in tasks if t["status"] == status]
    with col:
        st.subheader(f"{status.replace('_', ' ').title()} ({len(filtered)})")
        for t in filtered:
            with st.expander(f"{t['title'][:40]}", expanded=False):
                st.text(f"ID: {t['id']}")
                st.text(f"Type: {t.get('type', '-')}")
                st.text(f"Agent: {t.get('assigned_to', '-')}")
                st.text(f"Revisies: {t.get('revision_count', 0)}/{t.get('max_revisions', 3)}")
                if t.get("confidence_score"):
                    st.text(f"Confidence: {t['confidence_score']:.2f}")
                out = (t.get("output_data") or {}).get("content", "")
                if out:
                    st.markdown("**Output:**")
                    st.text_area("", out[:500], height=120, disabled=True,
                                 key=f"out_{t['id']}")
                if t.get("review_notes"):
                    st.markdown(f"**Review:** {t['review_notes'][:200]}")
