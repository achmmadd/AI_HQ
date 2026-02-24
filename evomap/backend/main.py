"""
AI-Holding Evomap Backend — FastAPI + SQLite (WAL) + WebSocket
"""
import json
import logging
import time
from contextlib import asynccontextmanager

from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import init_db, get_db, DATABASE_PATH
from websocket_manager import ws_manager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    logger.info("Evomap backend started, database=%s", DATABASE_PATH)
    yield
    logger.info("Evomap backend shutting down")


app = FastAPI(
    title="AI-Holding Evomap API",
    lifespan=lifespan,
)

class AgentCreate(BaseModel):
    id: Optional[str] = None
    name: str = "Unnamed Agent"
    current_task: str = ""
    status: str = "idle"
    parent_id: Optional[str] = None


class EdgeCreate(BaseModel):
    id: Optional[str] = None
    source: str
    target: str


class AgentPatch(BaseModel):
    name: Optional[str] = None
    current_task: Optional[str] = None
    status: Optional[str] = None


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "evomap-backend"}


@app.get("/api/agents")
async def list_agents():
    """Haal alle agents op voor initiële load."""
    async with get_db() as db:
        async with db.execute(
            "SELECT id, name, current_task, status, updated_at, parent_id FROM agents ORDER BY updated_at DESC"
        ) as cur:
            rows = await cur.fetchall()
    out = []
    for r in rows:
        rec = {"id": r["id"], "name": r["name"], "current_task": r["current_task"] or "", "status": r["status"], "updated_at": r["updated_at"]}
        try:
            rec["parent_id"] = r["parent_id"]
        except (KeyError, IndexError):
            rec["parent_id"] = None
        out.append(rec)
    return out


@app.get("/api/edges")
async def list_edges():
    """Haal alle edges op voor initiële load."""
    async with get_db() as db:
        async with db.execute(
            "SELECT id, source_id, target_id, updated_at FROM edges ORDER BY updated_at DESC"
        ) as cur:
            rows = await cur.fetchall()
    return [
        {
            "id": r["id"],
            "source": r["source_id"],
            "target": r["target_id"],
            "updated_at": r["updated_at"],
        }
        for r in rows
    ]


@app.post("/api/agents")
async def create_agent(agent: AgentCreate):
    """Maak een agent aan en push delta via WebSocket."""
    agent_id = agent.id or f"agent-{int(time.time() * 1000)}"
    name = agent.name
    current_task = agent.current_task
    status = agent.status
    parent_id = getattr(agent, "parent_id", None) or None
    now = time.time()

    async with get_db() as db:
        await db.execute(
            """
            INSERT OR REPLACE INTO agents (id, name, current_task, status, updated_at, parent_id)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (agent_id, name, current_task, status, now, parent_id),
        )
        await db.commit()

    delta = {
        "type": "agent",
        "action": "upsert",
        "payload": {
            "id": agent_id,
            "name": name,
            "current_task": current_task,
            "status": status,
            "updated_at": now,
            "parent_id": parent_id,
        },
    }
    await ws_manager.broadcast_delta(delta)
    return {"id": agent_id, "ok": True}


@app.post("/api/edges")
async def create_edge(edge: EdgeCreate):
    """Maak een edge aan en push delta via WebSocket."""
    edge_id = edge.id or f"edge-{edge.source}-{edge.target}"
    source = edge.source
    target = edge.target
    now = time.time()

    async with get_db() as db:
        await db.execute(
            """
            INSERT OR REPLACE INTO edges (id, source_id, target_id, updated_at)
            VALUES (?, ?, ?, ?)
            """,
            (edge_id, source, target, now),
        )
        await db.commit()

    delta = {
        "type": "edge",
        "action": "upsert",
        "payload": {
            "id": edge_id,
            "source": source,
            "target": target,
            "updated_at": now,
        },
    }
    await ws_manager.broadcast_delta(delta)
    return {"id": edge_id, "ok": True}


@app.post("/api/gemini/chat")
async def gemini_chat(request: dict = Body(default={})):
    """
    Gemini Pro Interactions API — orkestreert agent-denken.
    previous_interaction_id voor server-side state (geen zware history op NUC).
    """
    from gemini_mcp_gateway import create_interaction

    input_text = request.get("input", "")
    system_instruction = request.get("system_instruction")
    previous_id = request.get("previous_interaction_id")
    model = request.get("model", "gemini-2.5-flash")

    if not input_text:
        raise HTTPException(status_code=400, detail="input required")

    result = await create_interaction(
        input_text=input_text,
        system_instruction=system_instruction,
        previous_interaction_id=previous_id,
        model=model,
    )
    return result


@app.patch("/api/agents/{agent_id}")
async def update_agent(agent_id: str, patch: AgentPatch):
    """Update agent status/task en push delta."""
    updates = patch.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    now = time.time()
    updates["updated_at"] = now

    async with get_db() as db:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        params = list(updates.values()) + [agent_id]
        await db.execute(
            f"UPDATE agents SET {set_clause} WHERE id = ?",
            params,
        )
        if db.total_changes == 0:
            raise HTTPException(status_code=404, detail="Agent not found")
        await db.commit()

    delta = {
        "type": "agent",
        "action": "patch",
        "payload": {"id": agent_id, **updates},
    }
    await ws_manager.broadcast_delta(delta)
    return {"ok": True}


@app.post("/api/broadcast-snapshot")
async def broadcast_snapshot():
    """
    Lees huidige agents en edges uit de DB en stuur een snapshot naar alle
    verbonden WebSocket-clients. Handig na directe DB-wijzigingen (bijv. seed).
    """
    async with get_db() as db:
        async with db.execute(
            "SELECT id, name, current_task, status, updated_at, parent_id FROM agents"
        ) as cur:
            agents = [dict(r) for r in await cur.fetchall()]
        async with db.execute(
            "SELECT id, source_id, target_id, updated_at FROM edges"
        ) as cur:
            edges = [
                {"id": r["id"], "source": r["source_id"], "target": r["target_id"]}
                for r in await cur.fetchall()
            ]
    snapshot = {"type": "snapshot", "agents": agents, "edges": edges}
    await ws_manager.broadcast_delta(snapshot)
    return {"ok": True, "agents": len(agents), "edges": len(edges)}


@app.websocket("/ws/evomap")
async def websocket_evomap(websocket: WebSocket):
    """WebSocket endpoint voor realtime delta-updates."""
    await ws_manager.connect(websocket)
    try:
        # Stuur initiële snapshot bij connect
        async with get_db() as db:
            async with db.execute(
                "SELECT id, name, current_task, status, updated_at, parent_id FROM agents"
            ) as cur:
                agents = [dict(r) for r in await cur.fetchall()]
            async with db.execute(
                "SELECT id, source_id, target_id, updated_at FROM edges"
            ) as cur:
                edges = [
                    {"id": r["id"], "source": r["source_id"], "target": r["target_id"]}
                    for r in await cur.fetchall()
                ]
        snapshot = {"type": "snapshot", "agents": agents, "edges": edges}
        await websocket.send_text(json.dumps(snapshot))

        # Luister naar inkomende berichten (keep-alive / ping)
        while True:
            data = await websocket.receive_text()
            # Optioneel: client kan subscribe/unsubscribe of andere commands sturen
            if data == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(websocket)
