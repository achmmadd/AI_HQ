"""
WebSocket manager voor delta-pushes naar frontend.
Alleen kleine statuswijzigingen (delta's) worden gepusht.
"""
import json
import logging
from typing import Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class EvomapWebSocketManager:
    def __init__(self):
        self._connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)
        logger.info("Evomap WebSocket client connected, total=%d", len(self._connections))

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)
        logger.info("Evomap WebSocket client disconnected, total=%d", len(self._connections))

    async def broadcast_delta(self, delta: dict) -> None:
        """Push een delta-update naar alle verbonden clients."""
        if not self._connections:
            return
        msg = json.dumps(delta)
        dead = set()
        for ws in self._connections:
            try:
                await ws.send_text(msg)
            except Exception as e:
                logger.warning("WebSocket send failed: %s", e)
                dead.add(ws)
        for ws in dead:
            self._connections.discard(ws)


ws_manager = EvomapWebSocketManager()
