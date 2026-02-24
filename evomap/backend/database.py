"""
SQLite database met WAL (Write-Ahead Logging).
Voorkomt "database locked" bij asynchrone agent-acties.
Geen JSON voor state-opslag — alles in genormaliseerde tabellen.
"""
import os
import aiosqlite
from contextlib import asynccontextmanager
from pathlib import Path

DATABASE_PATH = os.getenv("DATABASE_PATH", "/data/evomap.db")


async def init_db(db_path: str = DATABASE_PATH) -> None:
    """Initialiseer database en schema."""
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    async with aiosqlite.connect(db_path) as db:
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.execute("PRAGMA synchronous=NORMAL;")
        await db.execute("PRAGMA busy_timeout=5000;")
        await db.execute("PRAGMA foreign_keys=ON;")

        await db.execute("""
            CREATE TABLE IF NOT EXISTS agents (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                current_task TEXT,
                status TEXT NOT NULL DEFAULT 'idle',
                updated_at REAL NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS edges (
                id TEXT PRIMARY KEY,
                source_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                updated_at REAL NOT NULL,
                FOREIGN KEY (source_id) REFERENCES agents(id),
                FOREIGN KEY (target_id) REFERENCES agents(id)
            )
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_agents_updated ON agents(updated_at);
        """)
        await db.execute("""
            CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
        """)
        # Optional parent_id voor hiërarchische groepering (Evomap frontend)
        try:
            await db.execute("ALTER TABLE agents ADD COLUMN parent_id TEXT")
        except Exception:
            pass
        await db.commit()


@asynccontextmanager
async def get_db():
    """Async context manager voor database-connecties."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute("PRAGMA journal_mode=WAL;")
        await db.execute("PRAGMA busy_timeout=5000;")
        db.row_factory = aiosqlite.Row
        yield db
