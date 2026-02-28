"""
Cost Tracker — kosten-overzicht per tenant/agent/model.
Leest uit cost_log in omega_db.
"""
from __future__ import annotations

import logging
from typing import Optional

import omega_db

logger = logging.getLogger(__name__)


def summary(tenant_id: str | None = None) -> list[dict]:
    """Geaggregeerde kosten per tenant/agent/model."""
    return omega_db.cost_log_summary(tenant_id)


def total_cost(tenant_id: str | None = None) -> float:
    """Totale kosten (USD) optioneel per tenant."""
    rows = summary(tenant_id)
    return sum(r.get("total_cost", 0.0) for r in rows)


def total_calls(tenant_id: str | None = None) -> int:
    """Totaal aantal LLM calls optioneel per tenant."""
    rows = summary(tenant_id)
    return sum(r.get("call_count", 0) for r in rows)
