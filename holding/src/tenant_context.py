"""
Tenant-isolatie: elke query wordt gefilterd op tenant_id.
Lunchroom data mag NOOIT lekken naar Webshop en vice versa.
"""
from __future__ import annotations

import json
import logging
import sqlite3
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)
CONFIG_DIR = Path(__file__).resolve().parent.parent.parent / "config"


class TenantContext:
    """Scoped database-toegang voor één tenant."""

    def __init__(self, tenant_id: str, conn: sqlite3.Connection):
        self.tenant_id = tenant_id
        self.db = conn

    def query(self, table: str, conditions: str = "", params: tuple = (),
              limit: int = 100) -> list[dict]:
        sql = f"SELECT * FROM {table} WHERE tenant_id = ?"
        if conditions:
            sql += f" AND {conditions}"
        sql += " LIMIT ?"
        rows = self.db.execute(sql, (self.tenant_id, *params, limit)).fetchall()
        return [dict(r) for r in rows]

    def insert(self, table: str, data: dict) -> None:
        data["tenant_id"] = self.tenant_id
        columns = ", ".join(data.keys())
        placeholders = ", ".join(["?"] * len(data))
        self.db.execute(
            f"INSERT INTO {table} ({columns}) VALUES ({placeholders})",
            tuple(data.values()),
        )
        self.db.commit()

    def count(self, table: str, conditions: str = "", params: tuple = ()) -> int:
        sql = f"SELECT COUNT(*) FROM {table} WHERE tenant_id = ?"
        if conditions:
            sql += f" AND {conditions}"
        return self.db.execute(sql, (self.tenant_id, *params)).fetchone()[0]


def load_tenant_configs() -> dict[str, dict]:
    """Laad tenant-profielen uit config/tenants.yaml."""
    path = CONFIG_DIR / "tenants.yaml"
    if not path.exists():
        logger.warning("config/tenants.yaml niet gevonden")
        return {}
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}
