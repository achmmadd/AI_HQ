"""
Standalone local executor on port 8790 (127.0.0.1 only).

  uvicorn executor_main:app --host 127.0.0.1 --port 8790
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

from local_executor import router as executor_router

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")
_secrets = Path("/secrets/env.local")
if _secrets.is_file():
	load_dotenv(_secrets)

app = FastAPI(title="MotorsAI Local Executor", version="0.1.0")
app.include_router(executor_router)
