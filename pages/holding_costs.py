"""Holding Costs — kosten per tenant/agent/model."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import streamlit as st

st.set_page_config(page_title="Holding Costs", page_icon="💰", layout="wide")
st.title("Holding Costs")

try:
    import omega_db
    omega_db.init_schema()
    from holding.src.cost_tracker import summary, total_cost, total_calls
except Exception as e:
    st.error(f"Module niet beschikbaar: {e}")
    st.stop()

tenants = omega_db.tenant_list()

st.metric("Totale kosten (USD)", f"${total_cost():.4f}")
st.metric("Totaal LLM calls", total_calls())

st.divider()

rows = summary()
if not rows:
    st.info("Nog geen kosten gelogd. Taken worden gelogd zodra agents actief zijn.")
    st.stop()

for tenant in tenants:
    st.subheader(tenant["name"])
    t_rows = [r for r in rows if r["tenant_id"] == tenant["id"]]
    if not t_rows:
        st.text("Geen data")
        continue

    tenant_total = sum(r.get("total_cost", 0) for r in t_rows)
    tenant_calls = sum(r.get("call_count", 0) for r in t_rows)
    c1, c2 = st.columns(2)
    c1.metric("Kosten", f"${tenant_total:.4f}")
    c2.metric("Calls", tenant_calls)

    for r in t_rows:
        st.text(
            f"  {r.get('agent_id', '-'):15s} | "
            f"{r.get('model_used', '-'):10s} | "
            f"{r.get('call_count', 0):4d} calls | "
            f"${r.get('total_cost', 0):.4f} | "
            f"tokens in: {r.get('total_in', 0)} out: {r.get('total_out', 0)}"
        )

    st.divider()
