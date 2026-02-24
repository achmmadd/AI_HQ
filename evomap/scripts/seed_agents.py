#!/usr/bin/env python3
"""
Seed Marketing Agency Swarm voor Evomap.
Vult agents en edges in SQLite; optioneel broadcast naar verbonden WebSocket-clients.
"""
import asyncio
import aiosqlite
import os
import time

DB = os.getenv("DATABASE_PATH", "/data/evomap.db")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

# Marketing Agency Swarm: 6 agenten
AGENTS = [
    ("jarvis", "Jarvis", "Monitoring Systems", "busy"),
    ("trend_hunter", "Trend-Hunter", "", "idle"),
    ("copy_architect", "Copy-Architect", "", "idle"),
    ("visual_strategist", "Visual Strategist", "", "idle"),
    ("seo_analyst", "SEO Analyst", "", "idle"),
    ("lead_gen", "Lead-Gen", "", "idle"),
]

# Edges: Jarvis → alle andere 5; workflow: trend_hunter → copy → visual → seo → lead_gen
def _edges():
    others = ["trend_hunter", "copy_architect", "visual_strategist", "seo_analyst", "lead_gen"]
    out = [(f"jarvis-{t}", "jarvis", t) for t in others]
    workflow = [
        ("trend_hunter-copy_architect", "trend_hunter", "copy_architect"),
        ("copy_architect-visual_strategist", "copy_architect", "visual_strategist"),
        ("visual_strategist-seo_analyst", "visual_strategist", "seo_analyst"),
        ("seo_analyst-lead_gen", "seo_analyst", "lead_gen"),
    ]
    out.extend(workflow)
    return out


async def main():
    os.makedirs(os.path.dirname(DB) or ".", exist_ok=True)
    now = time.time()

    async with aiosqlite.connect(DB) as db:
        await db.execute("PRAGMA journal_mode=WAL;")
        db.row_factory = aiosqlite.Row

        for agent_id, name, current_task, status in AGENTS:
            await db.execute(
                """
                INSERT OR REPLACE INTO agents (id, name, current_task, status, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (agent_id, name, current_task, status, now),
            )
        for edge_id, source_id, target_id in _edges():
            await db.execute(
                """
                INSERT OR REPLACE INTO edges (id, source_id, target_id, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (edge_id, source_id, target_id, now),
            )
        await db.commit()

    print("Seed OK: 6 agents, edges (Jarvis→all + workflow).")

    # Optioneel: broadcast snapshot naar verbonden frontends
    try:
        import urllib.request
        req = urllib.request.Request(
            f"{BACKEND_URL.rstrip('/')}/api/broadcast-snapshot",
            method="POST",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5) as resp:
            if 200 <= resp.status < 300:
                print("Broadcast snapshot sent to connected clients.")
            else:
                print("Broadcast returned status:", resp.status)
    except Exception as e:
        print("Warning: could not call broadcast-snapshot (backend unreachable?):", e)


if __name__ == "__main__":
    asyncio.run(main())
