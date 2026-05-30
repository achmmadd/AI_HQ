"""
FastAPI microservice: Browserbase session + browser-use agent (Ollama LLM).
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

from browser_use import Agent, BrowserSession
from browser_use.llm.ollama.chat import ChatOllama
from browserbase import AsyncBrowserbase
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")
_secrets_env = Path("/secrets/env.local")
if _secrets_env.is_file():
	load_dotenv(_secrets_env)

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("agent_service")

app = FastAPI(title="Agent MVP service", version="0.1.0")

_origins_raw = os.getenv(
	"CORS_ALLOW_ORIGINS",
	"http://127.0.0.1:3000,http://localhost:3000",
)
_allow_origins = [o.strip() for o in _origins_raw.split(",") if o.strip()]
if _allow_origins:
	app.add_middleware(
		CORSMiddleware,
		allow_origins=_allow_origins,
		allow_credentials=True,
		allow_methods=["*"],
		allow_headers=["*"],
	)


class AgentRunRequest(BaseModel):
	prompt: str = Field(..., min_length=1)
	klant: str = ""
	agent_mode: bool = True
	browser_task: bool = True
	session_id: str | None = None


def _ollama_llm() -> ChatOllama:
	model = os.getenv("OLLAMA_MODEL", "llama3.2")
	host = os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434")
	timeout_raw = os.getenv("OLLAMA_TIMEOUT_SECONDS")
	timeout: float | None = float(timeout_raw) if timeout_raw else 120.0
	return ChatOllama(model=model, host=host, timeout=timeout)


def _build_task(body: AgentRunRequest) -> str:
	parts = [body.prompt.strip()]
	if body.klant:
		parts.append(f"Klant context: {body.klant.strip()}.")
	if body.agent_mode:
		parts.append("Je werkt als agent in de browser; voer de taak uit en sluit af met een korte samenvatting.")
	else:
		parts.append("Voer alleen de gevraagde browserstappen uit.")
	return " ".join(parts)


@app.get("/health")
async def health() -> dict:
	return {
		"ok": True,
		"has_browserbase_key": bool(os.getenv("BROWSERBASE_API_KEY")),
		"ollama_model": os.getenv("OLLAMA_MODEL", "llama3.2"),
	}


@app.post("/agent/run")
async def agent_run(body: AgentRunRequest) -> dict:
	if not body.browser_task:
		raise HTTPException(status_code=400, detail="browser_task must be true for this MVP endpoint")

	api_key = os.getenv("BROWSERBASE_API_KEY")
	if not api_key:
		raise HTTPException(status_code=503, detail="BROWSERBASE_API_KEY is not set")

	max_steps = int(os.getenv("AGENT_MAX_STEPS", "15"))
	project_id = (os.getenv("BROWSERBASE_PROJECT_ID") or "").strip() or None

	bb = AsyncBrowserbase(api_key=api_key)
	browser_session: BrowserSession | None = None
	bb_session_id: str | None = None

	try:
		if body.session_id:
			retrieved = await bb.sessions.retrieve(body.session_id)
			bb_session_id = retrieved.id
			cdp = retrieved.connect_url
			if not cdp:
				raise HTTPException(
					status_code=400,
					detail="Existing session has no connect_url; create a new session instead",
				)
		else:
			create_kw: dict = {"keep_alive": True}
			if project_id:
				create_kw["project_id"] = project_id
			created = await bb.sessions.create(**create_kw)
			bb_session_id = created.id
			cdp = created.connect_url

		live = await bb.sessions.debug(bb_session_id)
		debugger_fullscreen_url = live.debugger_fullscreen_url

		browser_session = BrowserSession(cdp_url=cdp)
		llm = _ollama_llm()
		agent = Agent(
			task=_build_task(body),
			llm=llm,
			browser_session=browser_session,
			max_failures=int(os.getenv("AGENT_MAX_FAILURES", "5")),
			use_vision=os.getenv("AGENT_USE_VISION", "false").lower() in ("1", "true", "yes"),
			directly_open_url=True,
		)

		history = await agent.run(max_steps=max_steps)
		final = history.final_result()
		agent_ok = history.is_done()

		return {
			"ok": True,
			"session_id": bb_session_id,
			"debugger_fullscreen_url": debugger_fullscreen_url,
			"final_result": final,
			"agent_success": agent_ok,
		}
	except HTTPException:
		raise
	except Exception as e:
		logger.exception("agent_run failed")
		raise HTTPException(status_code=500, detail=str(e)) from e
	finally:
		if browser_session is not None:
			try:
				await browser_session.stop()
			except Exception:
				logger.exception("browser_session.stop failed")
		if bb_session_id:
			try:
				await bb.sessions.update(bb_session_id, status="REQUEST_RELEASE")
			except Exception:
				logger.exception("Browserbase session release failed")
		try:
			await bb.close()
		except Exception:
			logger.exception("AsyncBrowserbase close failed")
